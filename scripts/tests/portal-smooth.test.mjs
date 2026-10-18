// Moving between portal pages, with nothing jumping.
//
// Six things make that true, and each one is a thing somebody could undo by
// hand without noticing:
//
//   1. the payload is cached for the tab, so a second page draws at once
//   2. every area the payload fills holds its space open first
//   3. the scrollbar gutter is reserved, so the header is on the same pixel
//      whether a page is long or short
//   4. the faces are self-hosted, preloaded, and have metric-matched
//      fallbacks, so a heading does not reflow when its font lands
//   5. the theme is set before first paint, so a dark page never flashes white
//   6. the navigation cross-fades, the header is held still through it, and
//      anyone who asked for less motion gets none
//
// The shift itself is measured in a real browser, not here: jsdom does no
// layout. Headless Chrome at 1440px and 375px, with the payload held back
// 800ms, puts every page under 0.02 CLS, against 0.3324 on the dashboard
// before any of this. What this suite pins is the shape those numbers
// depend on.
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync, existsSync, statSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const bytes = (p) => statSync(new URL('../../' + p, import.meta.url)).size;
const SRC = read('portal/portal-tailwind-src.css');
const BUILT = read('portal/portal.css');
const ACCESS = read('portal/portal-access.js');

const PAGES = ['dashboard', 'curriculum', 'sessions', 'resources', 'prompts', 'members'];
const ALL = PAGES.concat(['index']);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

const docs = {};
for (const name of ALL) docs[name] = new JSDOM(read('portal/' + name + '.html')).window.document;
const html = {};
for (const name of ALL) html[name] = read('portal/' + name + '.html');

/* ---- 1. the payload cache ------------------------------------------------ */

console.log('\nThe payload is cached for the tab');
{
  check('it is sessionStorage, not localStorage',
    /window\.sessionStorage\.getItem\(PAYLOAD_CACHE_KEY\)/.test(ACCESS) &&
    /window\.sessionStorage\.setItem\(PAYLOAD_CACHE_KEY/.test(ACCESS));
  check('under a key of its own', /var PAYLOAD_CACHE_KEY = 'tr_portal_payload'/.test(ACCESS));
  check('and it is stamped with the session token it was fetched for',
    /JSON\.stringify\(\{ token: token, at: Date\.now\(\), data: data \}\)/.test(ACCESS));
  check('a stamp that does not match the token in hand is discarded unread',
    /if \(!saved \|\| saved\.token !== token\) return null;/.test(ACCESS));
  check('so is one that has gone stale',
    /Date\.now\(\) - saved\.at > PAYLOAD_TTL_MS/.test(ACCESS));
  check('the page draws from it before the fetch, not after',
    /var cached = readPayloadCache\(\);\s*\n\s*if \(cached\) applyData\(cached\);/.test(ACCESS));
  check('and a refresh that brings back the same answer redraws nothing',
    /if \(sameAsPainted\(data\)\) \{ setState\('in'\); return; \}/.test(ACCESS));
  check('a failed refresh leaves what is on screen alone',
    (ACCESS.match(/if \(cached\) return;/g) || []).length === 2,
    (ACCESS.match(/if \(cached\) return;/g) || []).length);
}

console.log('\nAnd it is cleared on the way out');
{
  const signOut = ACCESS.slice(ACCESS.indexOf('function signOut()'), ACCESS.indexOf('function setProgress'));
  check('signing out clears it', /clearPayloadCache\(\);/.test(signOut), signOut.slice(0, 400));
  check('along with the session and the members-link answer',
    /clearCode\(\);/.test(signOut) && /clearMembersLinkCache\(\);/.test(signOut));
  check('a token the server refuses clears it too',
    /status === 401\) \{ clearCode\(\); clearPayloadCache\(\);/.test(ACCESS));
}

// Driven for real, in a window, rather than read off the source.
console.log('\nDriven in a browser');
{
  const PAYLOAD = { ok: true, member: { first_name: 'Ella' }, weeks: [], sessions: [], progress: { items: [], sessions: [] } };
  function boot(token) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'https://timerich.ai/portal/dashboard.html',
      runScripts: 'outside-only',
      virtualConsole: new VirtualConsole(),
    });
    const w = dom.window;
    w.TR_PORTAL_CONFIG = { sessionUrl: 'https://worker.test/portal-session', logoutUrl: 'https://worker.test/portal-logout' };
    if (token) w.localStorage.setItem('tr_portal_session',
      JSON.stringify({ token, expires_at: new Date(Date.now() + 864e5).toISOString() }));
    w.fetch = () => Promise.resolve(new globalThis.Response('{}', { status: 200 }));
    w.eval(ACCESS);
    return w;
  }

  const w = boot('tok-ONE');
  w.TRPortal.writePayloadCache(PAYLOAD);
  check('what goes in comes back out',
    JSON.stringify(w.TRPortal.readPayloadCache()) === JSON.stringify(PAYLOAD));
  check('and it really is in sessionStorage',
    w.sessionStorage.getItem('tr_portal_payload') !== null &&
    w.localStorage.getItem('tr_portal_payload') === null);

  // The next member on the same machine.
  w.localStorage.setItem('tr_portal_session',
    JSON.stringify({ token: 'tok-TWO', expires_at: new Date(Date.now() + 864e5).toISOString() }));
  check('a different member never sees the last one’s data',
    w.TRPortal.readPayloadCache() === null);

  const out = boot('tok-ONE');
  out.TRPortal.writePayloadCache(PAYLOAD);
  check('it is there before signing out', out.TRPortal.readPayloadCache() !== null);
  out.TRPortal.signOut();
  check('and gone after', out.sessionStorage.getItem('tr_portal_payload') === null);
  check('with the session gone with it', out.localStorage.getItem('tr_portal_session') === null);

  const none = boot(null);
  check('with no session there is nothing to read', none.TRPortal.readPayloadCache() === null);
  none.TRPortal.writePayloadCache(PAYLOAD);
  check('and nothing is written either',
    none.sessionStorage.getItem('tr_portal_payload') === null);
}

/* ---- 2. reserved space --------------------------------------------------- */

console.log('\nEvery area the payload fills holds its space open');
{
  // A box that is `hidden` until data arrives is a box that appears from
  // nothing and pushes the page down. Each of these carries a placeholder
  // built from the real classes instead.
  const RESERVED = [
    ['dashboard', '[data-dash-step]', 'the next step card'],
    ['dashboard', '[data-dash-next]', 'the next session tile'],
    ['dashboard', '[data-dash-sessions]', 'the sessions tile'],
    ['dashboard', '[data-dash-list]', 'the Start here list'],
    ['dashboard', '[data-portal-setup]', 'the Set up once card'],
    ['dashboard', '[data-dash-countdown]', 'the countdown pill'],
    ['curriculum', '[data-curriculum-static]', 'the weeks'],
    ['curriculum', '[data-curriculum-bar]', 'the progress bar'],
    ['sessions', '#trSessionList', 'the schedule'],
    ['resources', '[data-res-links]', 'the quick links'],
    ['prompts', '#prompt-cards', 'the prompt grid'],
    ['prompts', '#prompt-ai-picker', 'the AI picker'],
  ];

  for (const [page, sel, what] of RESERVED) {
    const node = docs[page].querySelector(sel);
    check(page + ': ' + what + ' is not hidden, it is held open',
      node !== null && node.hasAttribute('hidden') === false,
      node === null ? 'missing' : 'hidden');
    check(page + ': ' + what + ' holds a placeholder',
      node !== null && node.querySelector('.trp-skel') !== null);
  }

  // The placeholders are built from the real classes, which is what makes
  // them the right height. A box of grey rectangles at a guessed height is
  // the thing this replaced.
  check('the dashboard placeholder uses the real card classes',
    docs.dashboard.querySelector('[data-dash-step].trp-nextstep') !== null &&
    docs.dashboard.querySelector('[data-dash-list].trp-dlist') !== null &&
    docs.dashboard.querySelector('[data-dash-next].trp-next') !== null);
  check('the curriculum placeholder uses the real week card',
    docs.curriculum.querySelector('[data-curriculum-static] .trp-check .trp-checks .trp-check-row') !== null);
  check('and holds as many rows as Week 1 has steps',
    docs.curriculum.querySelectorAll('[data-curriculum-static] .trp-check-row').length === 9,
    docs.curriculum.querySelectorAll('[data-curriculum-static] .trp-check-row').length);
  check('the prompts placeholder holds one card per card the page draws',
    docs.prompts.querySelectorAll('#prompt-cards .trp-pcard').length === 16,
    docs.prompts.querySelectorAll('#prompt-cards .trp-pcard').length);

  // Every placeholder is out of the reading order: there is nothing in one
  // to read, and the live region beside it says what is happening.
  const skels = PAGES.flatMap((p) => [...docs[p].querySelectorAll('.trp-skel')].map((n) => [p, n]));
  // Thirteen across the five pages that wait on data. Members waits on
  // nothing, so it has none; the count is asserted so that deleting a
  // placeholder cannot quietly pass this.
  check('thirteen placeholders, and every one hidden from assistive tech',
    skels.length === 13 && skels.every(([, n]) => n.getAttribute('aria-hidden') === 'true'),
    { count: skels.length,
      unlabelled: skels.filter(([, n]) => n.getAttribute('aria-hidden') !== 'true').map(([p]) => p) });

  // The renderers clear the box, so the real content replaces the
  // placeholder rather than appearing under it.
  check('the resources renderer takes its placeholder away',
    /var skel = root\.querySelector\('\[data-res-links-skel\]'\);\s*\n\s*if \(skel\) skel\.remove\(\);/.test(html.resources));
}

/* ---- 3. the header ------------------------------------------------------- */

console.log('\nThe header sits on the same pixel on every page');
{
  check('the root reserves the scrollbar gutter',
    /html \{ scrollbar-gutter: stable; overflow-y: scroll; \}/.test(SRC));
  check('both halves, because stable alone does not reserve on a short page',
    /scrollbar-gutter:stable;overflow-y:scroll/.test(BUILT.replace(/\s/g, '')),
    (BUILT.match(/html\{scrollbar-gutter[^}]*\}/) || [])[0]);

  // Measured in headless Chrome at 1440px: with the gutter, Members (one
  // card, no scrollbar) reports the same 1425px viewport as the five pages
  // that do scroll, and the header box, the wordmark and the theme control
  // land on identical coordinates on all six.

  // The header markup has to be the same on every page, or the gutter alone
  // would not be enough.
  const shape = (d) => {
    const h = d.querySelector('header#top-nav');
    return h ? h.className + '|' + [...h.children].map((c) => c.tagName + '.' + c.className).join(',') : null;
  };
  const base = shape(docs.dashboard);
  check('every page carries the same header markup',
    PAGES.every((p) => shape(docs[p]) === base),
    PAGES.filter((p) => shape(docs[p]) !== base));

  // The member's name is empty until the payload lands, and it sits in the
  // group at the end of the header.
  check('the name slot holds a name’s width open',
    /\[data-portal-name\] \{\s*min-width: 4\.5rem;\s*text-align: right;\s*\}/.test(SRC));
}

/* ---- 4. the fonts -------------------------------------------------------- */

console.log('\nThe faces are the page’s own, and they do not reflow it');
{
  check('Space Grotesk ships as woff2', existsSync(new URL('../../brand/fonts/SpaceGrotesk-Variable.woff2', import.meta.url)));
  check('so does JetBrains Mono', existsSync(new URL('../../brand/fonts/JetBrainsMono-Variable.woff2', import.meta.url)));
  check('and both are smaller than the .ttf they replace',
    bytes('brand/fonts/SpaceGrotesk-Variable.woff2') < bytes('brand/fonts/SpaceGrotesk-Variable.ttf') &&
    bytes('brand/fonts/JetBrainsMono-Variable.woff2') < bytes('brand/fonts/JetBrainsMono-Variable.ttf'));

  for (const name of ALL) {
    check(name + ': asks Google for nothing',
      !/fonts\.(googleapis|gstatic)\.com/.test(html[name]),
      (html[name].match(/.{0,40}fonts\.(googleapis|gstatic)\.com.{0,40}/) || [])[0]);
    const pre = [...docs[name].querySelectorAll('link[rel="preload"][as="font"]')];
    check(name + ': preloads both faces, with crossorigin',
      pre.length === 2 && pre.every((l) => l.hasAttribute('crossorigin') &&
        l.getAttribute('type') === 'font/woff2'),
      pre.map((l) => l.getAttribute('href') + '/' + l.getAttribute('type')));
  }

  check('both faces swap rather than hiding the text',
    (SRC.match(/font-display: swap;/g) || []).length === 2);
  check('the heading face has a metric-matched fallback',
    /font-family: 'Space Grotesk Fallback';/.test(SRC) &&
    /size-adjust: 89%;/.test(SRC) && /ascent-override: 110\.6%;/.test(SRC));
  check('so does the label face',
    /font-family: 'JetBrains Mono Fallback';/.test(SRC) &&
    /size-adjust: 106\.7%;/.test(SRC));
  check('and both fallbacks are in the stacks, ahead of the generic families',
    /--trp-face: 'Space Grotesk', 'Space Grotesk Fallback',/.test(SRC) &&
    /--trp-label: 'JetBrains Mono', 'JetBrains Mono Fallback',/.test(SRC));
  check('the built stylesheet carries them, so the source was rebuilt',
    BUILT.includes('Space Grotesk Fallback') && BUILT.includes('size-adjust:89%'));
}

/* ---- 5. the theme -------------------------------------------------------- */

console.log('\nThe theme is decided before the first paint');
{
  for (const name of ALL) {
    const scripts = [...docs[name].head.querySelectorAll('script')];
    const first = scripts[0];
    check(name + ': an inline script in <head> sets it, before anything else',
      first && !first.hasAttribute('src') && !first.hasAttribute('defer') &&
      !first.hasAttribute('async') && /data-theme/.test(first.textContent),
      first && (first.getAttribute('src') || first.textContent.slice(0, 40)));
    check(name + ': it reads the member’s choice and falls back to system',
      /tr_portal_theme/.test(first.textContent) &&
      /t !== 'light' && t !== 'dark'/.test(first.textContent));
    // The stylesheet must come after it, or the attribute is set too late
    // to decide what the first paint looks like.
    const css = docs[name].head.querySelector('link[href="portal.css"]');
    check(name + ': and the stylesheet comes after it',
      css !== null && first.compareDocumentPosition(css) === 4);
  }
}

/* ---- 6. the transition --------------------------------------------------- */

console.log('\nThe navigation cross-fades, and the header is held still');
{
  check('cross-document view transitions are on',
    /@view-transition \{ navigation: auto; \}/.test(SRC));
  check('the fade is short, between 150 and 200ms',
    /animation-duration: 180ms;/.test(SRC));
  check('the header is named, so it is its own transition group',
    /header#top-nav \{ view-transition-name: trp-header; \}/.test(SRC));
  check('and that group does not animate, so the header stays put',
    /::view-transition-group\(trp-header\) \{ animation-duration: 0ms; \}/.test(SRC) &&
    /::view-transition-old\(trp-header\),\s*\n\s*::view-transition-new\(trp-header\) \{ animation: none;/.test(SRC));
  check('less motion means no animation at all, not a shorter one',
    /@media \(prefers-reduced-motion: reduce\) \{\s*\n\s*::view-transition-group\(\*\),\s*\n\s*::view-transition-old\(\*\),\s*\n\s*::view-transition-new\(\*\) \{ animation: none !important; \}/.test(SRC));
  check('the built stylesheet carries all of it',
    BUILT.includes('@view-transition') &&
    BUILT.includes('view-transition-name:trp-header') &&
    /prefers-reduced-motion:reduce\)\{::view-transition-group\(\*\)/.test(BUILT.replace(/\s/g, '')));
}

console.log('\nAnd the next page is warmed on hover');
{
  for (const name of PAGES) {
    const rules = [...docs[name].querySelectorAll('script[type="speculationrules"]')];
    check(name + ': carries one set of speculation rules', rules.length === 1, rules.length);
    let parsed = null;
    try { parsed = JSON.parse(rules[0].textContent); } catch (e) { /* reported below */ }
    check(name + ': they are valid JSON that prefetches portal pages only',
      parsed !== null && Array.isArray(parsed.prefetch) &&
      parsed.prefetch[0].where.href_matches === '/portal/*.html',
      parsed);
    check(name + ': on hover, not on sight',
      parsed !== null && parsed.prefetch[0].eagerness === 'moderate',
      parsed && parsed.prefetch[0].eagerness);
  }
  // The sign-in page links nowhere inside the portal.
  check('the sign-in page has nothing to prefetch',
    docs.index.querySelectorAll('script[type="speculationrules"]').length === 0);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
