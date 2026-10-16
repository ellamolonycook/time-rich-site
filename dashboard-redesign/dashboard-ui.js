/* Presentation-only keyboard behavior for the existing mobile drawer. */
(function () {
  var panel = document.getElementById('mobile-menu');
  var trigger = document.getElementById('mobile-menu-btn');
  if (!panel || !trigger) return;
  var close = document.createElement('button');
  close.type = 'button';
  close.className = 'drawer-close';
  close.setAttribute('aria-label', 'Close menu');
  close.textContent = '×';
  panel.prepend(close);
  close.addEventListener('click', function () { trigger.click(); });
  function sync() {
    var open = trigger.getAttribute('aria-expanded') === 'true';
    panel.inert = !open;
    panel.setAttribute('aria-hidden', String(!open));
    if (open) close.focus();
    else if (panel.contains(document.activeElement)) trigger.focus();
  }
  new MutationObserver(sync).observe(trigger, {attributes:true,attributeFilter:['aria-expanded']});
  sync();
  panel.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var nodes = Array.from(panel.querySelectorAll('a[href],button,select')).filter(function (n) { return n.getClientRects().length && !n.disabled; });
    var first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {e.preventDefault();last.focus();}
    else if (!e.shiftKey && document.activeElement === last) {e.preventDefault();first.focus();}
  });
})();

/* Keep the supplied partner artwork intact, framing its transparent margins in CSS. */
(function () {
  document.querySelectorAll('.trp-powered').forEach(function (link) {
    link.querySelectorAll('img').forEach(function (image) { image.remove(); });
    var logo = document.createElement('span');
    logo.className = 'stanley-logo-frame';
    logo.setAttribute('role', 'img');
    logo.setAttribute('aria-label', 'Stanley');
    link.append(logo);
  });
})();

/* Day/night switch uses the original theme persistence handler. */
(function () {
  var select = document.querySelector('[data-theme-select]');
  if (!select) return;
  var switcher = document.createElement('button');
  switcher.type = 'button';
  switcher.className = 'day-night-switch';
  switcher.setAttribute('role', 'switch');
  switcher.setAttribute('aria-label', 'Night mode');
  switcher.innerHTML = '<span class="theme-switch-thumb"></span><svg class="theme-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg><svg class="theme-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14a8 8 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z"/></svg>';
  var preference = window.matchMedia('(prefers-color-scheme: dark)');
  function isDark() {
    var theme = document.documentElement.getAttribute('data-theme');
    return theme === 'dark' || (theme === 'system' && preference.matches);
  }
  function paint() {
    switcher.setAttribute('aria-checked', String(isDark()));
    switcher.title = isDark() ? 'Switch to day mode' : 'Switch to night mode';
  }
  select.parentElement.insertAdjacentElement('afterend', switcher);
  select.parentElement.hidden = true;
  switcher.addEventListener('click', function () {
    select.value = isDark() ? 'light' : 'dark';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    paint();
  });
  new MutationObserver(paint).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
  preference.addEventListener('change', paint);
  paint();
})();
