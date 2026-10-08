/* =====================================================================
 * Time Rich portal - Live Sessions page renderer.
 *
 * Listens for `trportal:data` from portal-access.js and fills #trSessionList
 * with the design used on sessions.html. Kept in its own file so the page
 * markup stays free of render logic.
 *
 * Rules:
 *   - createElement + textContent only (never innerHTML with API data)
 *   - times stay in Eastern Time (how the cohort is announced)
 *   - unlock uses the ET calendar day of starts_at (see
 *     TRLive.isSessionUnlocked) so every member opens together
 * ===================================================================== */
(function (window, document) {
  'use strict';

  var L = window.TRLive;
  if (!L) return;

  var NEXT_ROW = 'relative group flex flex-col md:flex-row items-start md:items-center justify-between gap-6 ' +
                 'p-6 lg:p-8 rounded-[1.5rem] glass-card border border-brand-deep/30 ' +
                 'shadow-[0_32px_64px_-16px_rgba(90,105,75,0.3)] md:-translate-y-1 transition-all z-10 ring-4 ring-brand-deep/5';
  var OPEN_ROW = 'group flex flex-col md:flex-row items-start md:items-center justify-between gap-6 ' +
                 'p-6 lg:p-8 rounded-[1.5rem] glass-card transition-all';
  var LOCK_ROW = 'group flex flex-col md:flex-row items-start md:items-center justify-between gap-6 ' +
                 'p-6 lg:p-8 rounded-[1.5rem] glass-card transition-all opacity-80 hover:opacity-100';

  var BTN_JOIN = 'w-full md:w-auto px-6 py-3 bg-brand-deep text-white text-xs font-bold rounded-xl shadow-md ' +
                 'hover:bg-brand-green transition-colors flex items-center justify-center gap-2';
  var BTN_JOIN_OFF = 'w-full md:w-auto px-6 py-3 bg-brand-deep text-white text-xs font-bold rounded-xl shadow-md ' +
                     'cursor-not-allowed opacity-50 flex items-center justify-center gap-2';
  var BTN_SOFT = 'w-full md:w-auto px-4 py-3 bg-brand-sagelt/60 text-brand-deep text-xs font-semibold rounded-xl ' +
                 'hover:bg-brand-sagelt transition-colors flex items-center justify-center gap-2';
  var BTN_SOFT_OFF = 'w-full md:w-auto px-4 py-3 bg-brand-sagelt/60 text-brand-deep/50 text-xs font-semibold rounded-xl ' +
                     'cursor-not-allowed flex items-center justify-center gap-2';

  var CAMERA_D = 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 ' +
                 '00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z';

  function cameraIcon() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'w-5 h-5');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('viewBox', '0 0 24 24');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('d', CAMERA_D);
    svg.appendChild(path);
    return svg;
  }

  function dot(className) {
    return L.el('span', className);
  }

  function disabledButton(label, className) {
    var btn = L.el('button', className, label);
    btn.type = 'button';
    btn.disabled = true;
    return btn;
  }

  // Join unlocks on the session's local calendar day. Calendar stays available
  // beforehand so members can save the date. Past sessions swap to recording.
  function actions(session, unlocked) {
    var box = L.el('div', 'w-full md:w-auto flex flex-col lg:flex-row gap-3 shrink-0');
    var past = L.isSessionPast(session);

    // Marking a session done only makes sense once it is open or over, so a
    // locked row never gets the toggle.
    var done = null;
    if (unlocked || past) {
      done = L.doneToggle(
        function () { return L.isSessionMarked(session); },
        function () { return L.toggleSession(session); }
      );
      box.appendChild(done);
    }

    // Joining or watching counts as having been there, so the toggle catches
    // up on its own rather than asking the member to tick it as well.
    function markOnUse(link) {
      if (!link) return link;
      link.addEventListener('click', function () {
        L.markSession(session);
        if (done && typeof done.refresh === 'function') done.refresh();
      });
      return link;
    }

    if (past) {
      var rec = markOnUse(L.linkTo(session.recording_url, 'Watch recording', BTN_SOFT));
      if (rec) box.appendChild(rec);
      return box.childNodes.length ? box : null;
    }

    if (unlocked) {
      var join = markOnUse(L.linkTo(session.join_url, 'Join via Zoom', BTN_JOIN));
      if (join) box.appendChild(join);
      else box.appendChild(disabledButton('Join via Zoom', BTN_JOIN_OFF));
    } else {
      box.appendChild(disabledButton('Join via Zoom', BTN_JOIN_OFF));
    }

    var cal = L.calendarMenu(session, BTN_SOFT,
      'px-3 py-2 rounded-lg text-xs text-left text-brand-deep hover:bg-brand-sagelt/50 transition-colors');
    if (cal) box.appendChild(cal);
    else box.appendChild(disabledButton('Add to Calendar', BTN_SOFT_OFF));

    return box;
  }

  function statusChip(kind) {
    if (kind === 'up_next') {
      var chip = L.el('div',
        'bg-brand-deep/5 text-brand-deep text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ' +
        'flex items-center gap-1.5 border border-brand-deep/10');
      var ping = L.el('span', 'relative flex h-1.5 w-1.5');
      ping.appendChild(dot('animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75'));
      ping.appendChild(dot('relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]'));
      chip.appendChild(ping);
      chip.appendChild(document.createTextNode('Up Next'));
      return chip;
    }

    if (kind === 'past') {
      var done = L.el('div',
        'bg-brand-deep/5 text-brand-mid/80 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-[0.1em] ' +
        'flex items-center gap-1.5 border border-brand-deep/5');
      done.appendChild(dot('w-1.5 h-1.5 rounded-full bg-brand-mid/40'));
      done.appendChild(document.createTextNode('Past'));
      return done;
    }

    var upcoming = L.el('div',
      'bg-brand-deep/5 text-brand-mid/80 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-[0.1em] ' +
      'flex items-center gap-1.5 border border-brand-deep/5');
    upcoming.appendChild(dot('w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.6)]'));
    upcoming.appendChild(document.createTextNode('Upcoming'));
    return upcoming;
  }

  function row(session, index, isNext, unlocked) {
    var past = L.isSessionPast(session);
    var highlight = isNext && !past;
    var open = unlocked || highlight;

    var wrap = L.el('div', highlight ? NEXT_ROW : (unlocked ? OPEN_ROW : LOCK_ROW));

    var left = L.el('div', open
      ? 'flex items-start gap-4 sm:gap-6 lg:gap-8 min-w-0'
      : 'flex items-start gap-4 sm:gap-6 lg:gap-8 min-w-0 opacity-75 group-hover:opacity-100 transition-opacity');

    var badge = L.el('div', highlight
      ? 'hidden sm:flex w-12 h-12 shrink-0 rounded-full bg-brand-deep text-white items-center justify-center shadow-md'
      : 'hidden sm:flex w-12 h-12 shrink-0 rounded-full border border-brand-green/15 text-brand-mid/50 items-center justify-center');
    if (highlight) badge.appendChild(cameraIcon());
    else badge.appendChild(L.el('span', 'text-xs font-bold', String(index + 1)));
    left.appendChild(badge);

    var body = L.el('div', 'space-y-2 min-w-0');

    var eyebrowRow = L.el('div', highlight ? 'flex flex-wrap items-center gap-3' : 'flex items-center gap-3');
    eyebrowRow.appendChild(L.el('span',
      highlight
        ? 'text-[10px] font-mono tracking-[0.2em] uppercase text-brand-deep/60 font-bold'
        : 'text-[10px] font-mono tracking-[0.2em] uppercase text-brand-deep/40 font-bold',
      'Session ' + (index + 1)));

    var kind = highlight ? 'up_next' : (past ? 'past' : 'upcoming');
    eyebrowRow.appendChild(statusChip(kind));
    body.appendChild(eyebrowRow);

    body.appendChild(L.el('h3',
      open ? (highlight ? 'text-lg sm:text-xl font-bold text-brand-deep' : 'text-lg font-bold text-brand-deep')
           : 'text-lg font-bold text-brand-deep/80',
      L.str(session.title) || 'Session'));

    var when = L.etDateTime(session.starts_at);
    if (when) {
      body.appendChild(L.el('p',
        open ? 'text-sm text-brand-mid font-medium' : 'text-sm text-brand-mid/80',
        when));
    }

    left.appendChild(body);
    wrap.appendChild(left);

    // Buttons only on the next session (may be disabled until unlock day)
    // and on unlocked sessions. Locked upcoming rows stay action-free.
    if (open) {
      var act = actions(session, unlocked);
      if (act) wrap.appendChild(act);
    }

    return wrap;
  }

  var ALL_SESSIONS_URL = 'https://cal.ae/z0j4nlqbgt6b';

  // One link that takes the whole cohort schedule, rather than nine separate adds.
  function addAllLine(count) {
    var line = L.el('p', 'mt-8 text-sm text-brand-mid');
    var a = L.el('a',
      'underline underline-offset-4 hover:text-brand-deep transition-colors',
      'Add all ' + count + ' sessions to your calendar');
    a.href = ALL_SESSIONS_URL;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    line.appendChild(a);
    return line;
  }

  function render(listEl, data) {
    var sessions = L.sessions(data);
    if (!listEl || !sessions.length) return;

    var now = new Date();
    var next = L.nextSession(data, now);

    L.clear(listEl);
    sessions.forEach(function (session, i) {
      listEl.appendChild(row(
        session,
        i,
        next != null && session === next,
        L.isSessionUnlocked(session, now)
      ));
    });

    listEl.appendChild(addAllLine(sessions.length));
  }

  document.addEventListener('trportal:data', function (event) {
    render(document.getElementById('trSessionList'), event && event.detail);
  });

})(window, document);
