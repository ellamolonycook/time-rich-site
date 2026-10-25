/* The portal's light/dark choice, in one place.
 *
 * Every portal page sets the attribute before first paint with a tiny inline
 * script in its <head> -- that one has to stay inline, because a file fetched
 * over the network would arrive after the first paint and the wrong theme
 * would flash. This file is the other half: it keeps the controls on the page
 * in step with the stored choice and writes a new choice back.
 *
 * It used to be copied into the foot of every page. Club was the one page
 * that never got the copy, so its toggle dispatched a `change` nobody was
 * listening for and nothing happened. One file, loaded everywhere, is what
 * stops that happening again.
 *
 * The control itself is drawn by portal-chrome.js, which replaces the <select>
 * with the sun/moon pill and fires a `change` on the hidden select. So the
 * select is still the thing that carries the value, here as before.
 */
(function () {
  'use strict';

  var KEY = 'tr_portal_theme';

  function clean(value) {
    return value === 'light' || value === 'dark' ? value : 'system';
  }

  function mount() {
    var selects = document.querySelectorAll('[data-theme-select]');
    if (!selects.length) return;

    var current = clean(document.documentElement.getAttribute('data-theme'));

    function apply(value) {
      document.documentElement.setAttribute('data-theme', value);
      try { window.localStorage.setItem(KEY, value); } catch (e) { /* choice lasts the session */ }
      // Every other control on the page follows.
      Array.prototype.forEach.call(selects, function (other) { other.value = value; });
      tell(value);
    }

    /* /club draws the member Club home in a full-bleed iframe and paints the
     * frame element itself in the theme's ground colour, so a member on the
     * dark theme does not get a white rectangle while the page loads. That
     * colour is read once, when the frame is made, so a choice made in here
     * afterwards would leave it stale. One message up puts it right. */
    function tell(value) {
      try {
        if (window.top !== window.self && window.parent) {
          window.parent.postMessage({ type: 'trportal:theme', theme: value }, window.location.origin);
        }
      } catch (e) { /* a frame we cannot reach is not worth a broken page */ }
    }

    Array.prototype.forEach.call(selects, function (select) {
      select.value = current;
      select.addEventListener('change', function () { apply(clean(select.value)); });
    });

    tell(current);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
