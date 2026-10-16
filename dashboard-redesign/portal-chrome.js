/* Shared portal chrome: the header's live-session button, the mobile menu and
 * the footer's community link.
 *
 * The header and footer markup itself is static in each page, so it paints
 * before any of this runs. This file only fills in the parts that depend on
 * the member's data, which arrives on the `trportal:data` event that
 * portal-access.js dispatches once the code has been checked.
 *
 * Everything built from that data goes in with createElement/textContent.
 */
(function () {
  'use strict';

  /* How close to the start time the "Join live session" button appears. */
  var LEAD_MINUTES = 30;
  var MINUTE = 60 * 1000;

  /* ---- live session button -------------------------------------------- */

  /* The session a member could join right now: one that started no more than
   * SESSION_MINUTES ago, or starts within the next LEAD_MINUTES. Sessions
   * without a join link are not joinable, so they are skipped. */
  function joinableSession(data, now) {
    var L = window.TRLive;
    if (!L) return null;

    var at = (now || new Date()).getTime();
    var runFor = (L.SESSION_MINUTES || 75) * MINUTE;
    var list = L.sessions(data);

    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (!L.safeUrl(s && s.join_url)) continue;

      var start = L.toDate(s && s.starts_at);
      if (!start) continue;

      var ms = start.getTime();
      if (at >= ms - LEAD_MINUTES * MINUTE && at <= ms + runFor) return s;
    }
    return null;
  }

  /* The button lives in the page as an empty, hidden <a>. It stays hidden
   * unless there is something to join, so a page with no live session simply
   * does not show it. */
  function renderJoin(data) {
    var L = window.TRLive;
    var slots = document.querySelectorAll('[data-portal-join]');
    if (!slots.length || !L) return;

    var session = joinableSession(data);

    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      L.clear(slot);

      if (!session) {
        slot.setAttribute('hidden', '');
        slot.removeAttribute('href');
        continue;
      }

      var url = L.safeUrl(session.join_url);
      slot.href = url.href;
      slot.target = '_blank';
      slot.rel = 'noopener noreferrer';
      slot.appendChild(document.createTextNode('Join live session'));
      slot.removeAttribute('hidden');
    }
  }

  /* ---- footer community link ------------------------------------------ */

  /* The WhatsApp community lives in week 0 as an ordinary link item. When the
   * member's data has no such item the footer entry is left hidden rather
   * than pointing nowhere. */
  function renderCommunity(data) {
    var L = window.TRLive;
    var slots = document.querySelectorAll('[data-portal-community]');
    if (!slots.length || !L) return;

    var item = L.findLinkItem(data, 0, 'whatsapp');
    var url = item ? L.safeUrl(item.url) : null;

    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (!url) {
        slot.setAttribute('hidden', '');
        continue;
      }
      slot.href = url.href;
      slot.target = '_blank';
      slot.rel = 'noopener noreferrer';
      slot.removeAttribute('hidden');
    }
  }

  /* ---- mobile menu ----------------------------------------------------- */

  /* The background is locked only while the menu is open, and the page is put
   * back exactly where it was on close. Locking with `position: fixed` is what
   * stops iOS scrolling the page behind the panel; the saved offset is what
   * stops it jumping to the top when the lock comes off. */
  function mountMenu() {
    var panel = document.getElementById('mobile-menu');
    var overlay = document.getElementById('mobile-menu-overlay');
    var button = document.getElementById('mobile-menu-btn');
    if (!panel || !button) return;

    var open = false;
    var savedY = 0;

    function lock() {
      savedY = window.pageYOffset || document.documentElement.scrollTop || 0;
      var b = document.body.style;
      b.position = 'fixed';
      b.top = -savedY + 'px';
      b.left = '0';
      b.right = '0';
      b.width = '100%';
    }

    function unlock() {
      var b = document.body.style;
      b.position = '';
      b.top = '';
      b.left = '';
      b.right = '';
      b.width = '';
      window.scrollTo(0, savedY);
    }

    function setOpen(next) {
      if (next === open) return;
      open = next;

      panel.classList.toggle('-translate-x-full', !open);
      button.setAttribute('aria-expanded', open ? 'true' : 'false');

      if (overlay) {
        overlay.classList.toggle('opacity-0', !open);
        overlay.classList.toggle('pointer-events-none', !open);
      }

      if (open) lock();
      else unlock();
    }

    button.addEventListener('click', function () { setOpen(!open); });
    if (overlay) overlay.addEventListener('click', function () { setOpen(false); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') setOpen(false);
    });

    /* Following a link navigates away, so the lock has to come off first or
     * the next page can inherit a scrolled-to-top body on the way back. */
    panel.addEventListener('click', function (e) {
      var link = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (link) setOpen(false);
    });

    /* A phone rotated to landscape, or a window dragged wider, lands on the
     * desktop nav; the lock would otherwise stay on with no way to undo it. */
    window.addEventListener('resize', function () {
      if (open && window.innerWidth >= 1024) setOpen(false);
    });
  }

  /* ---- wiring ---------------------------------------------------------- */

  function fill(data) {
    try { renderJoin(data); } catch (err) { /* chrome is not worth a broken page */ }
    try { renderCommunity(data); } catch (err) { /* ditto */ }
  }

  document.addEventListener('trportal:data', function (e) { fill(e && e.detail); });

  // The event may already have fired: this file is deferred, and a fetch that
  // resolves quickly gets there first. portal-access.js leaves the payload
  // behind for exactly this case.
  if (window.TR_PORTAL_DATA) fill(window.TR_PORTAL_DATA);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountMenu);
  } else {
    mountMenu();
  }
})();
