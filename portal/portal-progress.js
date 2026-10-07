/* =====================================================================
 * Time Rich portal - dashboard program and personal progress.
 *
 * Listens for `trportal:data` and fills [data-portal-progress].
 * Program is the cohort schedule. You is this passcode's local checklist.
 * ===================================================================== */
(function (window, document) {
  'use strict';

  var L = window.TRLive;
  if (!L) return;

  var EYEBROW = 'text-[10px] font-mono tracking-[0.2em] uppercase text-brand-deep/60 font-bold';
  var META    = 'text-sm text-brand-mid font-medium';
  var NOTE    = 'text-xs text-brand-mid/70';

  function meter(label, percent, detail) {
    var block = L.el('div', '');
    var top = L.el('div', 'flex items-end justify-between gap-4 mb-3');
    top.appendChild(L.el('p', EYEBROW, label));
    top.appendChild(L.el('p', 'text-3xl font-display font-bold tracking-tight text-brand-deep',
      String(percent) + '%'));
    block.appendChild(top);

    var track = L.el('div', 'h-1.5 w-full rounded-full bg-brand-deep/10 overflow-hidden');
    var fill = L.el('div', 'h-full rounded-full bg-brand-deep transition-all duration-500');
    fill.style.width = Math.max(0, Math.min(100, percent)) + '%';
    track.appendChild(fill);
    block.appendChild(track);

    if (detail) block.appendChild(L.el('p', META + ' mt-3', detail));
    return block;
  }

  function render(root, data) {
    if (!root || !data) return;

    var program = L.scheduleProgress(data);
    var you = L.userProgress(data);
    var programTotal = program.weeksTotal + program.sessionsTotal;
    if (!programTotal && !you.total) {
      L.show(root, false);
      return;
    }

    L.clear(root);

    var card = L.el('div', 'glass-card rounded-[1.75rem] p-8 flex flex-col gap-8');
    card.appendChild(meter(
      'Program',
      program.percent,
      'Curriculum · ' + program.weeksDone + ' of ' + program.weeksTotal + ' weeks' +
        '  ·  Live sessions · ' + program.sessionsDone + ' of ' + program.sessionsTotal
    ));

    var personal = meter(
      'You',
      you.percent,
      you.done + ' of ' + you.total + ' open items and sessions'
    );
    personal.appendChild(L.el('p', NOTE + ' mt-2', 'Saved on this device.'));
    card.appendChild(personal);

    root.appendChild(card);
    L.show(root, true);
  }

  document.addEventListener('trportal:data', function (event) {
    render(document.querySelector('[data-portal-progress]'), event && event.detail);
  });

})(window, document);
