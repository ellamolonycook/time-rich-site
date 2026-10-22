/* One-time member setup. A link opens the tool; only an explicit tick saves completion. */
(function () {
  'use strict';
  var root = document.querySelector('[data-portal-setup]');
  var L = window.TRLive;
  if (!root || !L) return;
  var data, editing = false, saving = false;
  var CALENDAR = 'https://www.addevent.com/calendar/z0j4nlqbgt6b';

  /* One row. "Duplicate your Superhuman OS" used to sit under this one, but
     Step 1 already carries "Duplicate the Superhuman Workbook" -- the same
     task under a second name, and the only one of the two marked Coming
     soon. The counts below are read off this list so they cannot drift
     from it again. */
  var STEPS = [
    {key: 'calendar', title: 'Add every session to your calendar', url: CALENDAR, action: 'Add all sessions'}
  ];
  function doneCount(state) {
    return STEPS.reduce(function (n, step) { return n + Number(state[step.key] === true); }, 0);
  }

  function render(focusStep, message) {
    var state = data.member && data.member.setup || {};
    var complete = doneCount(state) === STEPS.length;
    L.clear(root);
    root.className = 'glass-card is-static trp-setup';
    root.hidden = false;
    var heading = L.el('div', 'trp-setup-heading');
    heading.appendChild(L.el('h2', '', complete && !editing ? 'Setup complete' : 'Set up once'));
    if (complete) {
      var review = L.el('button', 'trp-setup-review', editing ? 'Close' : 'Review');
      review.type = 'button';
      review.setAttribute('aria-expanded', String(editing));
      review.addEventListener('click', function () { editing = !editing; render(); root.querySelector('button').focus(); });
      heading.appendChild(review);
    } else heading.appendChild(L.el('span', '', doneCount(state) + ' of ' + STEPS.length + ' complete'));
    root.appendChild(heading);
    if (complete && !editing) {
      heading.setAttribute('role', 'status');
      if (focusStep) root.querySelector('button').focus();
      return;
    }
    var steps = L.el('ol', 'trp-setup-steps');
    STEPS.forEach(function (step, index) {
      var row = L.el('li', 'trp-setup-step');
      var done = state[step.key] === true;
      row.classList.toggle('is-done', done);
      row.appendChild(L.el('span', 'trp-step-number', '0' + (index + 1)));
      var copy = L.el('div', 'trp-setup-copy');
      copy.appendChild(L.el('h3', '', step.title));
      row.appendChild(copy);
      var actions = L.el('div', 'trp-setup-actions');
      // Every step here carries a real link, so there is no "Coming soon"
      // branch to fall through to.
      var link = L.linkTo(step.url, step.action, 'trp-btn trp-btn-outline');
      if (link) actions.appendChild(link);
      var tick = L.el('button', 'trp-setup-tick', done ? 'Done' : 'Mark done');
      tick.type = 'button'; tick.dataset.setupStep = step.key;
      tick.setAttribute('aria-pressed', String(done));
      tick.setAttribute('aria-label', (done ? 'Undo: ' : 'Mark done: ') + step.title);
      tick.disabled = saving;
      tick.addEventListener('click', function () {
        if (saving) return;
        saving = true;
        root.querySelectorAll('[data-setup-step]').forEach(function (button) { button.disabled = true; });
        tick.textContent = 'Saving…';
        var save = window.TRPortal && window.TRPortal.setSetup;
        Promise.resolve().then(function () { return save ? save(step.key, !done) : false; }).catch(function () { return false; }).then(function (ok) {
          saving = false;
          if (ok) {
            data.member = data.member || {}; data.member.setup = data.member.setup || {};
            data.member.setup[step.key] = !done;
            if (doneCount(data.member.setup) === STEPS.length) editing = false;
          }
          render(step.key, ok ? 'Saved to your account.' : 'Could not save. Please try again.');
        });
      });
      actions.appendChild(tick); row.appendChild(actions); steps.appendChild(row);
    });
    root.appendChild(steps);
    var status = L.el('p', 'trp-setup-status', message || 'Mark each step done when you have finished. Saved to your account.');
    status.setAttribute('role', 'status'); root.appendChild(status);
    if (focusStep) {
      var focus = root.querySelector('[data-setup-step="' + focusStep + '"]') || root.querySelector('button');
      if (focus) focus.focus();
    }
  }
  function receive(value) { if (value) { data = value; render(); } }
  document.addEventListener('trportal:data', function (event) { receive(event.detail); });
  receive(window.TR_PORTAL_DATA);
})();
