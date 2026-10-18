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
 * There is no per-session "Add to calendar" any more, and none on the next
 * session card: one link at the top of the page subscribes to the whole
 * cohort schedule at once, and it is written into sessions.html rather than
 * built here, so it is on screen before the payload arrives. Data loading,
 * the unlock rule, the attended toggle, markOnUse, recordings and the
 * time-zone handling are the same calls as before.
 * ===================================================================== */
(function (window, document) {
  'use strict';

  var L = window.TRLive;
  if (!L) return;

  /* The shared pill, in its fills. These used to be hand-written Tailwind
     strings here and again in three other files, each a slightly different
     height and weight. Join via Zoom is this page's one pastel action;
     everything else is the outline. */
  var BTN_PRIMARY = 'trp-btn trp-btn-pastel';
  // Disabled. The label has to stay readable in both themes, so it is the
  // same ink as the page, muted, on a wash of that ink rather than a solid
  // fill with inverted text.
  var BTN_PRIMARY_OFF = 'trp-btn trp-btn-off';
  var ACTION_JOIN = 'trp-saction trp-btn trp-btn-primary trp-btn-sm';
  var ACTION_SOFT = 'trp-saction trp-btn trp-btn-outline trp-btn-sm';
  var ACTION_DEAD = 'trp-saction trp-btn trp-btn-sm trp-btn-dead';

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

  /* A small square tick that reflects the member's saved account progress. */
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
      Promise.resolve(L.toggleSession(session)).then(paint);
      paint();
    });
    paint();
    btn.refresh = paint;
    return btn;
  }

  /* ---- one row's single action ----------------------------------------- */

  function rowAction(session, unlocked, past, tick, now) {
    var name = L.str(session.title) || 'Session';

    function markOnUse(link) {
      if (!link) return link;
      link.addEventListener('click', function () {
        Promise.resolve(L.markSession(session)).then(function () {
          if (tick && typeof tick.refresh === 'function') tick.refresh();
        });
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

    // The same half-hour rule the card above the rows uses. A row that went
    // live at Eastern midnight while the next session card still read
    // "Opens 30 minutes before the start" was the page disagreeing with
    // itself. The note is not repeated on every row; the row has its date.
    if (L.isJoinOpen(session, now)) {
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

    if (unlocked) {
      var waiting = L.el('button', ACTION_DEAD, 'Join');
      waiting.type = 'button';
      waiting.disabled = true;
      waiting.setAttribute('aria-label',
        'Join ' + name + ' opens 30 minutes before the start');
      return waiting;
    }

    // Before its day there is nothing to press. The row keeps its date, its
    // title and its tick; the one subscribe link at the top of the page is
    // what puts the whole schedule in a member's calendar.
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
    var act = rowAction(session, unlocked, past, tick, now);
    if (act) slot.appendChild(act);
    row.appendChild(slot);

    row.appendChild(tick);
    return row;
  }

  /* ---- a week card ------------------------------------------------------ */

  // "Week 1: Diagnose and train" -> "Diagnose and train". A title that is only
  // the prefix, or no title at all, leaves the card with its label alone.
  function weekName(title, n) {
    var name = L.str(title).replace(/^\s*week\s*0*\d+\s*[:.–-]\s*/i, '').trim();
    if (!name) return '';
    if (name.toLowerCase() === 'week ' + n) return '';
    return name;
  }

  function weekCard(data, weekId, list, now) {
    var card = L.el('li', 'glass-card is-static trp-wkcard');

    var head = L.el('div', 'trp-wkcard-head');
    var n = L.num(weekId);
    var label = n === 0 ? 'Start here' : 'Week ' + (n < 10 ? '0' + n : n);
    head.appendChild(L.el('p', 'trp-tag', label));

    // The week's own name, from the payload. It used to come from a map in
    // this file whose values were the first session title of each week, so
    // every card said the same words twice: once as the heading and again in
    // the first row.
    //
    // The stored titles read "Week 1: Diagnose and train". The label beside
    // it already says WEEK 01, so the prefix comes off.
    var wk = L.weeks(data).filter(function (w) { return L.num(w && w.id) === n; })[0];
    var theme = weekName(wk && wk.title, n);

    // Week 0's label and its title are both "Start here", so showing both
    // just says it twice.
    if (theme && theme.toLowerCase() !== label.toLowerCase()) {
      head.appendChild(L.el('h2', 'trp-wkcard-theme', theme));
    }
    card.appendChild(head);

    var ul = L.el('ul', 'trp-srows');
    // One clock for the whole render, so the rows and the card above
    // them cannot land on different sides of a join window.
    list.forEach(function (s) { ul.appendChild(sessionRow(s, now)); });
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

    var acts2 = L.el('div', 'trp-next-acts');

    var tick = attendedToggle(next);

    function markOnUse(link) {
      if (!link) return link;
      link.addEventListener('click', function () {
        Promise.resolve(L.markSession(next)).then(function () {
          if (tick && typeof tick.refresh === 'function') tick.refresh();
        });
      });
      return link;
    }

    // The shared rule, the same call the dashboard makes: live from half an
    // hour before the start until the call ends, disabled with a line under
    // it before that.
    var join = L.joinControl(next, now, { onClass: BTN_PRIMARY, offClass: BTN_PRIMARY_OFF });
    if (join.open) markOnUse(join.control);
    acts2.appendChild(join.control);

    acts2.appendChild(tick);
    card.appendChild(acts2);
    if (join.note) card.appendChild(join.note);
    return card;
  }

  /* ---- all of it -------------------------------------------------------- */

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

    var weeks = L.el('ul', 'trp-wkcards');
    order.forEach(function (id) { weeks.appendChild(weekCard(data, id, byWeek[id], now)); });
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
