/* Shared portal chrome: the header's live-session button, the mobile menu,
 * the footer's community link, and the feedback form -- the pill, the panel
 * it opens, and the full page at /club/feedback, all from one component.
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

  function mountAppearance() {
    var media = window.matchMedia('(prefers-color-scheme: dark)');
    document.querySelectorAll('[data-theme-select]').forEach(function (select) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'trp-day-night';
      button.setAttribute('role', 'switch');
      button.setAttribute('aria-label', 'Night mode');
      button.innerHTML = '<span class="trp-day-night-thumb"></span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5l1.5 1.5M5 19l1.5-1.5M17.5 6.5l1.5-1.5"/></svg><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14a8 8 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z"/></svg>';
      function dark() {
        var theme = document.documentElement.getAttribute('data-theme');
        return theme === 'dark' || (theme !== 'light' && media.matches);
      }
      function paint() { button.setAttribute('aria-checked', String(dark())); }
      button.addEventListener('click', function () {
        select.value = dark() ? 'light' : 'dark';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        paint();
      });
      select.parentElement.hidden = true;
      select.parentElement.after(button);
      new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      media.addEventListener('change', paint);
      paint();
    });
  }

  // Native details remain usable without animation. Only one connection guide
  // stays open; rapid clicks reverse from the current height without jumping.
  var accordionControls = [];
  document.querySelectorAll('.trp-connect details').forEach(function (details) {
    var summary = details.querySelector('summary');
    if (!summary) return;
    var animation = null, expanded = details.open;
    function setOpen(next) {
      expanded = next;
      var from = details.getBoundingClientRect().height;
      if (animation) { animation.cancel(); animation = null; }
      if (!details.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        details.open = next; return;
      }
      details.open = true;
      var to = next ? details.scrollHeight : summary.getBoundingClientRect().height;
      details.style.overflow = 'hidden';
      animation = details.animate([{ height: from + 'px' }, { height: to + 'px' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
      animation.onfinish = function () { details.open = next; details.style.overflow = ''; animation = null; };
    }
    accordionControls.push({ details: details, close: function () { if (expanded) setOpen(false); } });
    summary.addEventListener('click', function (event) {
      event.preventDefault();
      var next = !expanded;
      if (next) accordionControls.forEach(function (control) { if (control.details !== details) control.close(); });
      setOpen(next);
    });
  });

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

  /* ---- the scroll lock, shared ----------------------------------------- */

  /* The background is locked only while something is over it, and the page is
   * put back exactly where it was on close. Locking with `position: fixed` is
   * what stops iOS scrolling the page behind a panel; the saved offset is what
   * stops it jumping to the top when the lock comes off.
   *
   * It lives out here because two things need it now -- the mobile menu and
   * the feedback panel -- and they must not each keep their own idea of where
   * the page was. Only one of them is ever open at a time, so one saved
   * offset is enough. */
  var lockedY = 0;

  function lockScroll() {
    lockedY = window.pageYOffset || document.documentElement.scrollTop || 0;
    var b = document.body.style;
    b.position = 'fixed';
    b.top = -lockedY + 'px';
    b.left = '0';
    b.right = '0';
    b.width = '100%';
  }

  function unlockScroll() {
    var b = document.body.style;
    b.position = '';
    b.top = '';
    b.left = '';
    b.right = '';
    b.width = '';
    window.scrollTo(0, lockedY);
  }

  /* ---- mobile menu ----------------------------------------------------- */

  function mountMenu() {
    var panel = document.getElementById('mobile-menu');
    var overlay = document.getElementById('mobile-menu-overlay');
    var button = document.getElementById('mobile-menu-btn');
    if (!panel || !button) return;

    var open = false;

    function setOpen(next) {
      if (next === open) return;
      open = next;

      panel.classList.toggle('-translate-x-full', !open);
      button.setAttribute('aria-expanded', open ? 'true' : 'false');

      if (overlay) {
        overlay.classList.toggle('opacity-0', !open);
        overlay.classList.toggle('pointer-events-none', !open);
      }

      if (open) lockScroll();
      else unlockScroll();
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

  /* ---- the feedback form ----------------------------------------------
   *
   * One component, mounted in two places: the full page at /club/feedback,
   * which exists so a link in an email or a Zoom chat still works, and the
   * panel the pill opens on every other Club page. Neither is a copy of the
   * other -- both call buildFeedback().
   *
   * The field names are the contract with the Worker, which is the contract
   * with Notion: createApplication maps a posted key to the database
   * property of the same name. Every one of them is posted on every submit,
   * empty or not, so the contract is visible in one object rather than
   * assembled from whatever happened to be filled in.
   */

  var FB_ENDPOINT = 'https://time-rich-forms.timerich.workers.dev/feedback';

  // How long the thank-you sits before it settles into its calm state. A
  // seam for the tests, which would otherwise wait three real seconds.
  function settleMs() {
    var set = window.TR_FEEDBACK_SETTLE_MS;
    return typeof set === 'number' ? set : 3000;
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  // The same test the content workshop draw uses, so a member is told the
  // same thing in both places.
  function isLinkedIn(value) { return /linkedin\.com\/./i.test(value); }

  function icon(d, size) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', size || '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
    return svg;
  }

  /* A textarea two lines tall that grows as it is typed into and stops at
     six, so a long answer is readable without the card running off. */
  function autoGrow(area) {
    function fit() {
      area.style.height = 'auto';
      var line = 23;                       // 15px type at 1.5
      var max = line * 6 + 24;             // six lines plus the padding
      area.style.height = Math.min(area.scrollHeight, max) + 'px';
      area.style.overflowY = area.scrollHeight > max ? 'auto' : 'hidden';
    }
    area.addEventListener('input', fit);
    return fit;
  }

  function buildFeedback(opts) {
    opts = opts || {};

    var wrap = el('div', 'trp-fb-wrap');
    wrap.setAttribute('data-feedback', '');

    /* ---- the step indicator ---- */
    var stepper = el('div', 'trp-fb-steps');
    function stepPip(n, label) {
      var box = el('span', 'trp-fb-step' + (n === 1 ? ' is-on' : ''));
      box.setAttribute('data-step', String(n));
      box.appendChild(el('span', 'trp-fb-step-n', String(n)));
      box.appendChild(el('span', '', label));
      return box;
    }
    var pip1 = stepPip(1, 'Feedback');
    var pip2 = stepPip(2, 'Testimonial');
    stepper.appendChild(pip1);
    stepper.appendChild(el('span', 'trp-fb-step-line'));
    stepper.appendChild(pip2);
    wrap.appendChild(stepper);

    /* ---- the form card ---- */
    var form = el('form', 'trp-fb-card');
    form.setAttribute('data-feedback-form', '');
    form.noValidate = true;
    wrap.appendChild(form);

    var nameField = el('input');
    nameField.type = 'hidden';
    nameField.name = 'Name';
    nameField.setAttribute('data-feedback-name', '');
    form.appendChild(nameField);

    var sourceField = el('input');
    sourceField.type = 'hidden';
    sourceField.name = 'Source';
    sourceField.value = 'club-feedback';
    form.appendChild(sourceField);

    // Off-screen rather than display:none: some bots skip what is not
    // rendered at all.
    var pot = el('input', 'trp-fb-pot');
    pot.type = 'text';
    pot.name = '_gotcha';
    pot.tabIndex = -1;
    pot.setAttribute('autocomplete', 'off');
    pot.setAttribute('aria-hidden', 'true');
    form.appendChild(pot);

    /* ---- step 1 ---- */
    var step1 = el('div', 'trp-fb-sections');
    step1.setAttribute('data-feedback-step', '1');
    form.appendChild(step1);

    var sec1 = el('div', 'trp-fb-section');
    step1.appendChild(sec1);

    var emailBox = el('div', 'trp-fb-field');
    var emailLabel = el('label', 'trp-fb-label', 'Your email');
    var email = el('input', 'trp-fb-input');
    email.type = 'email';
    email.name = 'Email';
    email.id = 'trp-fb-email-' + (opts.idSuffix || 'page');
    email.setAttribute('autocomplete', 'email');
    email.setAttribute('inputmode', 'email');
    email.required = true;
    emailLabel.setAttribute('for', email.id);
    emailBox.appendChild(emailLabel);
    emailBox.appendChild(email);
    emailBox.appendChild(el('span', 'trp-fb-help',
      'So we can thank you, and reach you about the Testimonial Prize.'));
    sec1.appendChild(emailBox);

    var rateBox = el('fieldset', 'trp-fb-field');
    rateBox.appendChild(el('legend', 'trp-fb-label', "How's the accelerator going for you?"));
    var scale = el('div', 'trp-fb-scale');
    var chips = [];
    for (var n = 1; n <= 10; n++) {
      var pick = el('label');
      var radio = el('input');
      radio.type = 'radio';
      radio.name = 'Rating';
      radio.value = String(n);
      pick.appendChild(radio);
      pick.appendChild(el('span', 'trp-fb-chip', String(n)));
      scale.appendChild(pick);
      chips.push(radio);
    }
    rateBox.appendChild(scale);
    var ends = el('div', 'trp-fb-ends');
    ends.appendChild(el('span', '', '1 · not great'));
    ends.appendChild(el('span', '', '10 · brilliant'));
    rateBox.appendChild(ends);
    sec1.appendChild(rateBox);

    var two = el('div', 'trp-fb-two');
    function answer(name, label) {
      var box = el('div', 'trp-fb-field');
      var lab = el('label', 'trp-fb-label');
      lab.appendChild(document.createTextNode(label + ' '));
      lab.appendChild(el('span', 'trp-fb-opt', '(optional)'));
      var area = el('textarea', 'trp-fb-area');
      area.name = name;
      area.rows = 2;
      area.id = 'trp-fb-' + name.replace(/\s+/g, '-').toLowerCase() + '-' + (opts.idSuffix || 'page');
      lab.setAttribute('for', area.id);
      autoGrow(area);
      box.appendChild(lab);
      box.appendChild(area);
      two.appendChild(box);
      return area;
    }
    var useful = answer('Most useful', 'Most useful so far');
    var change = answer('One thing to change', 'One thing to change');
    sec1.appendChild(two);

    var foot1 = el('div', 'trp-fb-foot');
    var hint1 = el('p', 'trp-fb-msg');
    hint1.hidden = true;
    /* Next carries aria-disabled rather than the disabled attribute. A
       disabled button fires no click, and the brief asks for a hint when it
       is tapped early -- so it stays clickable, says it is unavailable, and
       explains itself instead of doing nothing. */
    var next = el('button', 'trp-fb-btn', 'Next →');
    next.type = 'button';
    next.setAttribute('data-feedback-next', '');
    var right1 = el('div', 'trp-fb-foot-right');
    right1.appendChild(next);
    foot1.appendChild(hint1);
    foot1.appendChild(right1);
    step1.appendChild(foot1);

    /* ---- step 2 ---- */
    var step2 = el('div', 'trp-fb-sections');
    step2.setAttribute('data-feedback-step', '2');
    step2.hidden = true;
    form.appendChild(step2);

    var sec2 = el('div', 'trp-fb-section');
    step2.appendChild(sec2);

    var head2 = el('h2', 'trp-fb-label', 'Your testimonial (optional)');
    head2.tabIndex = -1;
    head2.setAttribute('data-feedback-step2-head', '');
    sec2.appendChild(head2);

    var prize = el('div', 'trp-fb-prize');
    prize.appendChild(el('span', '', '🏆'));
    prize.appendChild(el('span', '',
      'Do both to enter the Testimonial Prize: a 30-minute strategy call with our mentors.'));
    sec2.appendChild(prize);

    var tiles = el('div', 'trp-fb-tiles');
    sec2.appendChild(tiles);

    // Written
    var tileA = el('div', 'trp-fb-tile');
    tileA.appendChild(el('span', 'trp-fb-tile-title', 'Recommend Ella'));
    tileA.appendChild(el('span', 'trp-fb-help', 'On her profile: More, then Recommend.'));
    var ella = el('a', 'trp-fb-btn is-soft', "Open Ella's LinkedIn ↗");
    ella.href = 'https://www.linkedin.com/in/ellamolonycook/';
    ella.target = '_blank';
    ella.rel = 'noopener';
    tileA.appendChild(ella);
    var switchFoot = el('div', 'trp-fb-tile-foot');
    var recLabel = el('label', 'trp-fb-switch');
    var rec = el('input');
    rec.type = 'checkbox';
    rec.setAttribute('data-feedback-rec', '');
    recLabel.appendChild(rec);
    recLabel.appendChild(el('span', 'trp-fb-track'));
    recLabel.appendChild(el('span', '', "I've done it"));
    switchFoot.appendChild(recLabel);
    tileA.appendChild(switchFoot);
    tiles.appendChild(tileA);

    // Video
    var tileB = el('div', 'trp-fb-tile');
    tileB.appendChild(el('span', 'trp-fb-tile-title', 'Post a video'));
    tileB.appendChild(el('span', 'trp-fb-help',
      '30 to 60 seconds on LinkedIn about what you’ve built. Tag Ella Molony Cook and use #trcsuperhuman.'));
    var videoFoot = el('div', 'trp-fb-tile-foot trp-fb-field');
    var videoLabel = el('label', 'trp-fb-label', 'Paste your LinkedIn post link');
    var video = el('input', 'trp-fb-input');
    video.type = 'url';
    video.name = 'LinkedIn video post';
    video.id = 'trp-fb-video-' + (opts.idSuffix || 'page');
    video.placeholder = 'https://www.linkedin.com/posts/...';
    video.setAttribute('autocomplete', 'off');
    videoLabel.setAttribute('for', video.id);
    var videoErr = el('span', 'trp-fb-msg is-err');
    videoErr.hidden = true;
    videoErr.setAttribute('data-feedback-video-error', '');
    videoFoot.appendChild(videoLabel);
    videoFoot.appendChild(video);
    videoFoot.appendChild(videoErr);
    tileB.appendChild(videoFoot);
    tiles.appendChild(tileB);

    var featureLabel = el('label', 'trp-fb-check');
    var feature = el('input');
    feature.type = 'checkbox';
    feature.setAttribute('data-feedback-feature', '');
    featureLabel.appendChild(feature);
    featureLabel.appendChild(el('span', '', 'Time Rich can share my feedback and testimonial'));
    sec2.appendChild(featureLabel);

    var foot2 = el('div', 'trp-fb-foot');
    var back = el('button', 'trp-fb-quiet', '← Back');
    back.type = 'button';
    back.setAttribute('data-feedback-back', '');
    var skip = el('button', 'trp-fb-quiet', 'Skip, just send my feedback');
    skip.type = 'button';
    skip.setAttribute('data-feedback-skip', '');
    var send = el('button', 'trp-fb-btn', 'Send it');
    send.type = 'submit';
    send.setAttribute('data-feedback-send', '');
    var err2 = el('p', 'trp-fb-msg is-err');
    err2.hidden = true;
    err2.setAttribute('data-feedback-error', '');
    var right2 = el('div', 'trp-fb-foot-right');
    right2.appendChild(skip);
    right2.appendChild(send);
    foot2.appendChild(back);
    foot2.appendChild(right2);
    step2.appendChild(err2);
    step2.appendChild(foot2);

    /* ---- the thank-you, which replaces the card ---- */
    var thanks = el('div', 'trp-fb-card');
    thanks.hidden = true;
    thanks.setAttribute('data-feedback-thanks', '');
    thanks.setAttribute('role', 'status');
    thanks.setAttribute('aria-live', 'polite');
    thanks.tabIndex = -1;
    wrap.appendChild(thanks);

    /* ---- behaviour ---- */

    function rating() {
      for (var i = 0; i < chips.length; i++) if (chips[i].checked) return chips[i].value;
      return '';
    }
    function emailOk() { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()); }
    function step1Ready() { return emailOk() && rating() !== ''; }

    function refreshNext() {
      var ready = step1Ready();
      next.setAttribute('aria-disabled', ready ? 'false' : 'true');
      next.classList.toggle('is-off', !ready);
      if (ready) { hint1.hidden = true; hint1.textContent = ''; }
    }
    email.addEventListener('input', refreshNext);
    chips.forEach(function (r) { r.addEventListener('change', refreshNext); });
    refreshNext();

    function show(step) {
      var to2 = step === 2;
      // The outgoing half fades and lifts, the incoming one eases in, and
      // the card keeps its place so the page never jumps.
      (to2 ? step1 : step2).hidden = true;
      var into = to2 ? step2 : step1;
      into.hidden = false;
      into.classList.remove('trp-fb-anim-in');
      void into.offsetWidth;
      into.classList.add('trp-fb-anim-in');
      pip1.classList.toggle('is-on', !to2);
      pip2.classList.toggle('is-on', to2);
      if (to2 && head2.focus) head2.focus();
    }

    next.addEventListener('click', function () {
      if (!step1Ready()) {
        hint1.hidden = false;
        hint1.className = 'trp-fb-msg is-err';
        hint1.textContent = !emailOk()
          ? 'Add your email, and pick a number from 1 to 10.'
          : 'Pick a number from 1 to 10.';
        (emailOk() ? chips[0] : email).focus();
        return;
      }
      show(2);
    });
    back.addEventListener('click', function () { show(1); });

    function videoOk() {
      var value = video.value.trim();
      if (!value || isLinkedIn(value)) { videoErr.hidden = true; video.removeAttribute('aria-invalid'); return true; }
      videoErr.hidden = false;
      videoErr.textContent = 'Paste the link to your LinkedIn post, like https://www.linkedin.com/posts/...';
      video.setAttribute('aria-invalid', 'true');
      return false;
    }
    video.addEventListener('input', function () { if (videoErr.hidden === false) videoOk(); });
    video.addEventListener('blur', videoOk);

    function collect() {
      return {
        Name: nameField.value,
        Email: email.value.trim(),
        Rating: rating(),
        'Most useful': useful.value.trim(),
        'One thing to change': change.value.trim(),
        'LinkedIn recommendation': rec.checked ? 'Done' : 'Not yet',
        'LinkedIn video post': video.value.trim(),
        'OK to feature': feature.checked ? 'Yes' : 'No',
        Source: 'club-feedback',
        _gotcha: pot.value.trim()
      };
    }

    function hasInput() {
      return Boolean(email.value.trim() || rating() || useful.value.trim() ||
        change.value.trim() || video.value.trim() || rec.checked || feature.checked);
    }

    var sending = false;

    function settle() {
      while (thanks.firstChild) thanks.removeChild(thanks.firstChild);
      var box = el('div', 'trp-fb-settled');
      box.appendChild(el('p', 'trp-fb-settled-line', 'Feedback sent ✓'));
      var go = el('a', 'trp-fb-btn is-soft', 'Back to the course');
      go.href = '/club/curriculum';
      go.setAttribute('data-feedback-done', '');
      box.appendChild(go);
      thanks.appendChild(box);
      thanks.classList.remove('trp-fb-anim-in');
      void thanks.offsetWidth;
      thanks.classList.add('trp-fb-anim-settle');
      if (typeof opts.onSettled === 'function') opts.onSettled();
    }

    function succeed(data) {
      form.classList.add('trp-fb-anim-out');
      stepper.hidden = true;
      window.setTimeout(function () {
        form.hidden = true;

        var both = data['LinkedIn recommendation'] === 'Done' && Boolean(data['LinkedIn video post']);
        var box = el('div', 'trp-fb-thanks');
        var ring = el('div', 'trp-fb-thanks-ring');
        ring.appendChild(icon('M5 13l4 4L19 7', '2.5'));
        box.appendChild(ring);
        box.appendChild(el('p', 'trp-fb-thanks-title', 'Thank you!! 💚'));
        box.appendChild(el('p', 'trp-fb-thanks-line', both
          ? "You're in the running for the Testimonial Prize."
          : 'This genuinely shapes what we build next.'));
        thanks.appendChild(box);
        thanks.hidden = false;
        thanks.classList.add('trp-fb-anim-in');
        if (thanks.focus) thanks.focus();
        window.setTimeout(settle, settleMs());
      }, 200);
    }

    function fail(message) {
      sending = false;
      send.disabled = false;
      while (send.firstChild) send.removeChild(send.firstChild);
      send.appendChild(document.createTextNode('Send it'));
      err2.hidden = false;
      err2.textContent = message;
    }

    function submit() {
      if (sending) return;                       // double-click safe
      if (!step1Ready()) { show(1); refreshNext(); next.click(); return; }
      if (!videoOk()) { show(2); video.focus(); return; }

      var data = collect();
      sending = true;
      send.disabled = true;
      err2.hidden = true;
      while (send.firstChild) send.removeChild(send.firstChild);
      send.appendChild(el('span', 'trp-fb-spin'));
      send.appendChild(document.createTextNode('Sending…'));

      window.fetch(FB_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          return { ok: res.ok && body.ok !== false, body: body };
        });
      }).then(function (out) {
        if (!out.ok) {
          return fail((out.body && out.body.error) ||
            'That didn’t go through. Try again in a moment.');
        }
        succeed(data);
      }).catch(function () {
        fail('That didn’t go through. Check your connection and try again.');
      });
    }

    form.addEventListener('submit', function (event) { event.preventDefault(); submit(); });
    skip.addEventListener('click', submit);

    /* The member's first name, off the session the portal already loaded.
       The email cannot come from there: the browser keeps the session token
       after sign-in and never the address. */
    function fillName(data) {
      var first = data && data.member && data.member.first_name;
      if (first && !nameField.value) nameField.value = String(first);
    }
    document.addEventListener('trportal:data', function (e) { fillName(e && e.detail); });
    if (window.TR_PORTAL_DATA) fillName(window.TR_PORTAL_DATA);

    return {
      root: wrap,
      hasInput: hasInput,
      focusFirst: function () { if (email.focus) email.focus(); }
    };
  }

  /* ---- the pill, and the panel it opens -------------------------------- */

  var NO_PILL = /\/club\/(feedback|signin)(\.html)?\/?$/;

  function mountFeedbackPill() {
    if (NO_PILL.test(window.location.pathname)) return;

    var pill = el('button', 'trp-pill');
    pill.type = 'button';
    pill.setAttribute('data-feedback-pill', '');
    pill.hidden = true;
    pill.appendChild(icon('M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z'));
    pill.appendChild(el('span', 'trp-pill-text', 'Feedback'));
    pill.setAttribute('aria-label', 'Give feedback');
    document.body.appendChild(pill);
    document.documentElement.classList.add('trp-has-pill');

    var dim = el('div', 'trp-panel-dim');
    dim.hidden = true;
    dim.setAttribute('data-feedback-dim', '');
    document.body.appendChild(dim);

    var panel = el('div', 'trp-panel');
    panel.hidden = true;
    panel.setAttribute('data-feedback-panel', '');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'trp-panel-title');

    var head = el('div', 'trp-panel-head');
    var title = el('h2', 'trp-panel-title', "Tell us how it's going");
    title.id = 'trp-panel-title';
    var shut = el('button', 'trp-panel-x');
    shut.type = 'button';
    shut.setAttribute('aria-label', 'Close');
    shut.setAttribute('data-feedback-close', '');
    shut.appendChild(icon('M18 6L6 18M6 6l12 12'));
    head.appendChild(title);
    head.appendChild(shut);
    panel.appendChild(head);

    var confirm = el('div', 'trp-panel-confirm');
    confirm.hidden = true;
    confirm.setAttribute('data-feedback-confirm', '');
    confirm.appendChild(el('span', '', 'Close without sending?'));
    var yes = el('button', 'trp-fb-quiet', 'Close');
    yes.type = 'button';
    yes.setAttribute('data-feedback-confirm-yes', '');
    var no = el('button', 'trp-fb-quiet', 'Keep writing');
    no.type = 'button';
    no.setAttribute('data-feedback-confirm-no', '');
    confirm.appendChild(yes);
    confirm.appendChild(no);
    panel.appendChild(confirm);

    var body = el('div', 'trp-panel-body');
    panel.appendChild(body);
    document.body.appendChild(panel);

    var open = false;
    var footerSeen = false;
    var built = null;

    /* ---- when the pill is not welcome ---- */

    function menuOpen() {
      var menu = document.getElementById('mobile-menu');
      return Boolean(menu && !menu.classList.contains('-translate-x-full'));
    }
    function typing() {
      var node = document.activeElement;
      if (!node) return false;
      var tag = (node.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select';
    }
    function narrow() { return window.innerWidth < 640; }

    function blocked() {
      if (open) return true;
      if (footerSeen) return true;
      if (document.querySelector('.trp-cw-lb')) return true;      // the video lightbox
      if (menuOpen()) return true;
      if (document.querySelector('.trp-toast[data-show]')) return true;
      if (document.fullscreenElement) return true;                 // a video full screen
      if (narrow() && typing()) return true;                       // the on-screen keyboard
      return false;
    }

    var letIn = false;
    var wasAway = null;

    /* Nothing is written unless the answer has actually changed. The observer
       below watches document.body, and the pill and the panel are both in it,
       so a refresh that always wrote would retrigger the observer that called
       it and spin forever. */
    function refresh() {
      if (!letIn) return;
      var away = blocked();
      if (away === wasAway) return;
      wasAway = away;
      pill.classList.toggle('is-away', away);
      pill.setAttribute('aria-hidden', away ? 'true' : 'false');
    }

    /* It arrives a couple of seconds in, once, and never moves again. */
    window.setTimeout(function () {
      letIn = true;
      pill.hidden = false;
      void pill.offsetWidth;
      pill.classList.add('is-shown');
      refresh();
    }, 2000);

    // The footer already carries "Give feedback", so the pill steps aside
    // rather than sitting on top of footer links.
    var footer = document.querySelector('footer');
    if (footer && typeof window.IntersectionObserver === 'function') {
      new window.IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) footerSeen = entries[i].isIntersecting;
        refresh();
      }).observe(footer);
    }

    // The lightbox, the toast and the menu are all added, removed or
    // re-classed on the fly, so the pill watches for that rather than
    // asking each of them to tell it.
    if (typeof window.MutationObserver === 'function') {
      new window.MutationObserver(function (records) {
        // Our own furniture is skipped, so the pill changing does not count
        // as a reason to look again.
        for (var i = 0; i < records.length; i++) {
          var node = records[i].target;
          if (node === pill || node === panel || node === dim) continue;
          if (panel.contains(node) || pill.contains(node)) continue;
          refresh();
          return;
        }
      }).observe(document.body, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['class', 'data-show', 'hidden']
      });
    }
    document.addEventListener('focusin', refresh);
    document.addEventListener('focusout', refresh);
    document.addEventListener('fullscreenchange', refresh);
    window.addEventListener('resize', refresh);

    /* ---- the panel ---- */

    var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])';

    function trap(event) {
      if (!open || event.key !== 'Tab') return;
      var able = panel.querySelectorAll(FOCUSABLE);
      var live = [];
      for (var i = 0; i < able.length; i++) if (able[i].offsetParent !== null || able[i] === document.activeElement) live.push(able[i]);
      if (!live.length) return;
      var first = live[0], last = live[live.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    function setOpen(next) {
      if (next === open) return;
      open = next;

      panel.hidden = !open;
      dim.hidden = !open;
      void panel.offsetWidth;
      panel.classList.toggle('is-open', open);
      dim.classList.toggle('is-open', open);
      pill.setAttribute('aria-expanded', open ? 'true' : 'false');

      if (open) {
        lockScroll();
        if (!built) {
          built = buildFeedback({
            idSuffix: 'panel',
            onSettled: function () {
              // It closes itself once the thank-you has settled. The pill
              // stays, so a member can send more feedback later; the next
              // open starts a fresh form (Gideon, 6 Nov).
              window.setTimeout(function () {
                setOpen(false);
                if (built && built.root.parentNode) built.root.parentNode.removeChild(built.root);
                built = null;
              }, 400);
            }
          });
          body.appendChild(built.root);
        }
        confirm.hidden = true;
        if (built.focusFirst) built.focusFirst();
      } else {
        unlockScroll();
        confirm.hidden = true;
        if (pill.focus && !pill.hidden) pill.focus();
      }
      refresh();
    }

    function askToClose() {
      if (built && built.hasInput()) { confirm.hidden = false; no.focus(); return; }
      setOpen(false);
    }

    pill.addEventListener('click', function () { setOpen(true); });
    shut.addEventListener('click', askToClose);
    dim.addEventListener('click', askToClose);
    yes.addEventListener('click', function () { setOpen(false); });
    no.addEventListener('click', function () { confirm.hidden = true; });
    document.addEventListener('keydown', function (event) {
      if (!open) return;
      if (event.key === 'Escape' || event.key === 'Esc') { event.preventDefault(); askToClose(); }
      else trap(event);
    });

    /* A seam for the tests: the footer's observer and the media query are
       both things jsdom does not have. Nothing on the page uses this. */
    window.TRFeedbackPill = {
      el: pill,
      panel: panel,
      refresh: refresh,
      open: function () { setOpen(true); },
      close: function () { setOpen(false); },
      askToClose: askToClose,
      setFooterInView: function (yes2) { footerSeen = Boolean(yes2); refresh(); },
      isOpen: function () { return open; }
    };
  }

  /* The full page at /club/feedback mounts the same component, into the
     container the page leaves for it. No page-level JavaScript either way. */
  function mountFeedbackPage() {
    var host = document.querySelector('[data-feedback-mount]');
    if (!host) return;
    var built = buildFeedback({ idSuffix: 'page' });
    host.appendChild(built.root);
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

  /* Each piece is mounted inside its own try: a feedback form that throws is
   * not worth taking the menu or the theme control down with it. */
  function mountAll() {
    var each = [mountMenu, mountAppearance, mountFeedbackPage, mountFeedbackPill];
    for (var i = 0; i < each.length; i++) {
      try { each[i](); } catch (err) { /* chrome is not worth a broken page */ }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll);
  } else {
    mountAll();
  }
})();
