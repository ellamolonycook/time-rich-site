/* One-time member setup. A link opens the tool; only an explicit tick saves completion. */
(function () {
  'use strict';
  var root = document.querySelector('[data-portal-setup]');
  var L = window.TRLive;
  if (!root || !L) return;
  var data, editing = false, saving = false;
  var CALENDAR = 'https://www.addevent.com/calendar/z0j4nlqbgt6b';

  function templateUrl() {
    var config = window.TR_PORTAL_CONFIG || {};
    var configured = L.safeUrl(config.notionTemplateUrl);
    if (configured) return configured.href;
    var match = null;
    L.weeks(data).some(function (week) {
      if (!week.unlocked) return false;
      return L.items(week).some(function (item) {
        var url = L.safeUrl(item.url);
        if (url && /(^|\.)notion\.(site|so)$/.test(url.hostname) && /superhuman\s+os/i.test(item.title || '')) {
          match = url.href; return true;
        }
        return false;
      });
    });
    return match;
  }

  function render(focusStep, message) {
    var state = data.member && data.member.setup || {};
    var complete = state.calendar === true && state.notion === true;
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
    } else heading.appendChild(L.el('span', '', (Number(state.calendar === true) + Number(state.notion === true)) + ' of 2 complete'));
    root.appendChild(heading);
    if (complete && !editing) {
      heading.setAttribute('role', 'status');
      if (focusStep) root.querySelector('button').focus();
      return;
    }
    var steps = L.el('ol', 'trp-setup-steps');
    var notion = templateUrl();
    [{key: 'calendar', title: 'Add every session to your calendar', url: CALENDAR, action: 'Add all sessions'},
     {key: 'notion', title: 'Duplicate your Superhuman OS', url: notion, action: 'Duplicate in Notion'}].forEach(function (step, index) {
      var row = L.el('li', 'trp-setup-step');
      var done = state[step.key] === true;
      row.classList.toggle('is-done', done);
      row.appendChild(L.el('span', 'trp-step-number', '0' + (index + 1)));
      var copy = L.el('div', 'trp-setup-copy');
      copy.appendChild(L.el('h3', '', step.title));
      if (!step.url) copy.appendChild(L.el('p', 'trp-setup-placeholder', '[NOTION_TEMPLATE_URL]'));
      row.appendChild(copy);
      var actions = L.el('div', 'trp-setup-actions');
      var link = L.linkTo(step.url, step.action, 'trp-btn trp-btn-outline');
      if (link) actions.appendChild(link);
      else {
        var pending = L.el('button', 'trp-btn trp-btn-outline', step.action);
        pending.type = 'button'; pending.disabled = true; actions.appendChild(pending);
      }
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
            if (data.member.setup.calendar && data.member.setup.notion) editing = false;
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
