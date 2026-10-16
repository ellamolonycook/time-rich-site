/* =====================================================================
 * Time Rich portal - dashboard progress.
 *
 * Listens for `trportal:data` and fills [data-portal-progress].
 *
 * This used to be two identical meters, "Programme 7%" and "You 0%", stacked
 * in a tall card. They measured unrelated things: the first is the cohort
 * calendar, which a member cannot move, and the second is their own ticking.
 * Shown the same way they invited a comparison that means nothing, and the
 * percentages shouted over the counts that actually say where you are.
 *
 * Now: one line. Where the cohort is, what you have done, and a single thin
 * bar for the only part you control.
 * ===================================================================== */
(function (window, document) {
  'use strict';

  var L = window.TRLive;
  if (!L) return;

  function render(root, data) {
    if (!root || !data) return;

    var program = L.scheduleProgress(data);
    var you = L.userProgress(data);
    if (!program.weeksTotal && !you.total) {
      L.show(root, false);
      return;
    }

    /* userProgress counts items and sessions together. Split them so the
       line can name both rather than saying "17 open items and sessions". */
    var sessionList = L.sessions(data).filter(function (s) { return L.sessionKey(s); });
    var sessionsDone = 0;
    for (var i = 0; i < sessionList.length; i++) {
      if (L.isSessionMarked(sessionList[i])) sessionsDone += 1;
    }
    var materialsTotal = Math.max(0, you.total - sessionList.length);
    var materialsDone = Math.max(0, you.done - sessionsDone);

    L.clear(root);

    var card = L.el('div', 'glass-card is-static trp-progress');

    var top = L.el('div', 'trp-progress-top');
    top.appendChild(L.el('p', 'trp-tag', 'Your progress'));
    top.appendChild(L.el('p', 'trp-progress-count', you.done + ' of ' + you.total + ' done'));
    var meter = L.el('div', 'trp-progress-meter');
    card.appendChild(meter);

    /* One bar, for the member's own ticking. The cohort's calendar is not
       something to fill in, so it does not get a bar. */
    var track = L.el('div', 'trp-progress-track');
    var fill = L.el('div', 'trp-progress-fill');
    fill.style.width = Math.max(0, Math.min(100, you.percent)) + '%';
    track.style.setProperty('--progress', Math.max(0, Math.min(100, you.percent)) + '%');
    track.setAttribute('data-percent', Math.round(Math.max(0, Math.min(100, you.percent))) + '%');
    var percent = Math.max(0, Math.min(100, you.percent));
    track.innerHTML = '<svg class="progress-ring" viewBox="0 0 80 80" aria-hidden="true"><circle class="progress-ring-base" cx="40" cy="40" r="34"/><circle class="progress-ring-value" cx="40" cy="40" r="34" pathLength="100" stroke-dasharray="100" stroke-dashoffset="' + (100 - percent) + '"' + (percent === 0 ? ' visibility="hidden"' : '') + '/></svg>';
    track.appendChild(fill);
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', String(you.total));
    track.setAttribute('aria-valuenow', String(you.done));
    track.setAttribute('aria-label', 'Your progress: ' + you.done + ' of ' + you.total + ' done');
    meter.appendChild(track);
    meter.appendChild(top);

    var parts = [];
    if (program.weeksTotal) parts.push('Week ' + program.weeksDone + ' of ' + program.weeksTotal);
    if (sessionList.length) parts.push(sessionsDone + ' of ' + sessionList.length + ' sessions');
    if (materialsTotal) parts.push(materialsDone + ' of ' + materialsTotal + ' materials');
    card.appendChild(L.el('p', 'trp-progress-line', parts.join(' · ')));

    card.appendChild(L.el('p', 'trp-progress-note', 'Ticks are saved to your account'));

    root.appendChild(card);
    L.show(root, true);
  }

  document.addEventListener('trportal:data', function (event) {
    render(document.querySelector('[data-portal-progress]'), event && event.detail);
  });

  document.addEventListener('trportal:progress', function () {
    render(document.querySelector('[data-portal-progress]'), window.TR_PORTAL_DATA);
  });

  // The event may already have fired: this file is deferred, and a fetch that
  // resolves quickly gets there first. portal-access.js leaves the payload
  // behind for exactly this case.
  if (window.TR_PORTAL_DATA) {
    render(document.querySelector('[data-portal-progress]'), window.TR_PORTAL_DATA);
  }

})(window, document);
