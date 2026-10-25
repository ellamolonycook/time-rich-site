// Regressions for the delayed body-fade navigation competing with native
// view transitions. Run with: node scripts/tests/portal-navigation.test.mjs
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const pages = ['home', 'dashboard', 'curriculum', 'resources', 'members', 'sessions', 'prompts', 'signin'];

/* The file a nav link is asking for. The links are extensionless now, so
   /club/resources is served from club/resources.html -- the same mapping
   GitHub Pages does. The .html form is still resolved too, because the files
   it names are all still there.

   /club is its own page rather than a portal one: it serves Apply to anyone
   without a session and frames the Club home for a member. */
function fileFor(url) {
  const path = url.pathname;
  if (path === '/club' || path === '/club/') return 'club/index.html';
  if (path.endsWith('.html')) return path.slice(1);
  if (path.endsWith('/')) return path.slice(1) + 'index.html';
  return path.slice(1) + '.html';
}

let linksChecked = 0;
for (const page of pages) {
  const html = process.env.NAV_TEST_BASELINE === '1'
    ? execFileSync('git', ['show', 'HEAD:club/' + page + '.html'], {encoding:'utf8'})
    : readFileSync(new URL('../../club/' + page + '.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://timerich.ai/club/' + page + '.html',
    runScripts: 'outside-only', virtualConsole: new VirtualConsole()
  });
  const w = dom.window, d = w.document;
  w.matchMedia = () => ({ matches: false });
  // Exercise any page-transition click handler, without running authentication,
  // analytics or content renderers. The removed handler fails these assertions.
  for (const script of d.querySelectorAll('script:not([src])')) {
    if (script.textContent.includes('SMOOTH PAGE TRANSITIONS')) w.eval(script.textContent);
  }
  d.dispatchEvent(new w.Event('DOMContentLoaded'));
  const links = [...d.querySelectorAll('#top-nav a[href], #mobile-menu a[href], nav[aria-label="Accelerator"] a[href]')];
  for (const link of links) {
    const url = new URL(link.href);
    if (url.origin !== w.location.origin) continue;
    assert(existsSync(new URL('../../' + fileFor(url), import.meta.url)),
      page + ': missing destination ' + url.pathname);
    // Rapid clicks and modified clicks must retain native navigation behavior.
    for (const options of [{}, {}, {ctrlKey:true}, {metaKey:true}]) {
      const event = new w.MouseEvent('click', {bubbles:true, cancelable:true, button:0, ...options});
      link.dispatchEvent(event);
      assert(!event.defaultPrevented, page + ': navigation intercepted for ' + link.textContent.trim());
      assert.notEqual(d.body.style.opacity, '0', page + ': page hidden before navigation');
      assert.equal(d.body.style.transform, '', page + ': page shrunk before navigation');
    }
    linksChecked++;
  }
  if (page === 'home') assert.equal(d.querySelector('base').target, '_top');

  /* The light/dark choice is one shared file, loaded by every portal page.
     It was copied into the foot of seven of the eight instead, and Club was
     the one that never got the copy -- so its toggle dispatched a `change`
     nobody listened for and clicking it did nothing. A page that carries its
     own copy again, or stops loading the shared one, is that bug coming back. */
  const theme = [...d.querySelectorAll('script[src]')]
    .filter((t) => /portal-theme\.js/.test(t.getAttribute('src')));
  assert.equal(theme.length, 1, page + ': should load portal-theme.js exactly once');
  assert(theme[0].hasAttribute('defer'), page + ': portal-theme.js should be deferred');

  const inline = [...d.querySelectorAll('script:not([src])')].map((t) => t.textContent);
  const writers = inline.filter((t) => /localStorage\.setItem\('tr_portal_theme'/.test(t));
  assert.equal(writers.length, 0, page + ': the theme is written by the shared file, not inline');

  // The pre-paint reader does stay inline: over the network it would land
  // after the first paint and the wrong theme would flash.
  const prepaint = inline.filter((t) => /localStorage\.getItem\('tr_portal_theme'\)/.test(t));
  assert.equal(prepaint.length, 1, page + ': should set the theme before first paint, inline');
  assert(d.head.contains(d.querySelector('script:not([src])')),
    page + ': the pre-paint script should be the first thing in <head>');

  // And every page offers the control the shared file wires up.
  assert(d.querySelector('[data-theme-select]'), page + ': missing the theme control');

  dom.window.close();
}
/* ---- an old .html address tidies itself -------------------------------
   Nothing in the portal links to a .html address any more, but the files are
   all still served and the .html form is what sits in bookmarks and in the
   emails already sent. A member who arrives that way should end up looking
   at the clean address, without a reload and without losing the query or the
   hash -- the sign-in link carries a code in the query.

   This runs the real portal-access.js in a window rather than reading it. */
const ACCESS = readFileSync(new URL('../../club/portal-access.js', import.meta.url), 'utf8');

function arriveAt(url, { framed = false } = {}) {
  const store = {};
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url, runScripts: 'outside-only', virtualConsole: new VirtualConsole(),
    beforeParse(win) {
      Object.defineProperty(win, 'localStorage', {
        value: {
          getItem: () => null, setItem: (k, v) => { store[k] = String(v); },
          removeItem: (k) => { delete store[k]; },
        },
      });
      /* A framed page must be left alone. The Club home is framed at /club,
         where the bar shows /club and the frame's own address was never on
         screen to tidy.

         isFramed() asks whether window.top is window.self, and in jsdom
         `top` cannot be redefined while `self` can, so the two are split
         from the other side. The comparison is the same either way. */
      if (framed) Object.defineProperty(win, 'self', { value: Object.create(win) });
    },
  });
  const win = dom.window;
  // Nothing should reach the network: mount() runs on the same evaluation.
  win.fetch = () => new Promise(() => {});
  win.eval(ACCESS);
  const after = win.location.href;
  win.close();
  return after;
}

for (const [arrived, want] of [
  ['https://timerich.ai/club/resources.html', 'https://timerich.ai/club/resources'],
  ['https://timerich.ai/club/home.html', 'https://timerich.ai/club/home'],
  ['https://timerich.ai/club/signin.html', 'https://timerich.ai/club/signin'],
  // The query and the hash come along.
  ['https://timerich.ai/club/signin.html?code=abc', 'https://timerich.ai/club/signin?code=abc'],
  ['https://timerich.ai/club/resources.html#faq', 'https://timerich.ai/club/resources#faq'],
  ['https://timerich.ai/club/sessions.html?w=2#now', 'https://timerich.ai/club/sessions?w=2#now'],
  // A clean address is already right and must not be touched.
  ['https://timerich.ai/club/resources', 'https://timerich.ai/club/resources'],
  ['https://timerich.ai/club/signin', 'https://timerich.ai/club/signin'],
]) {
  assert.equal(arriveAt(arrived), want, arrived + ' should settle on ' + want);
}

// Inside the /club frame there is no address bar of ours to tidy.
assert.equal(arriveAt('https://timerich.ai/club/home.html', { framed: true }),
  'https://timerich.ai/club/home.html', 'a framed page should be left alone');

/* ---- the old /portal addresses ------------------------------------------
   The portal moved from /portal to /club. GitHub Pages has no server-side
   redirects, so each old file is a page that sends the member on, and it is
   what both /portal/resources and /portal/resources.html are served from.
   Every one of them has to land on a page that exists, with the query and
   the hash intact.

   The script is run against a stand-in window rather than in jsdom, which
   does not navigate; what it is handed is the whole of what it reads. */
const MOVED = {
  'index': '/club/signin',
  'club': '/club',
  'curriculum': '/club/curriculum',
  'dashboard': '/club/dashboard',
  'members': '/club/members',
  'prompts': '/club/prompts',
  'resources': '/club/resources',
  'sessions': '/club/sessions',
};
for (const [old, want] of Object.entries(MOVED)) {
  const html = readFileSync(new URL('../../portal/' + old + '.html', import.meta.url), 'utf8');
  const doc = new JSDOM(html).window.document;
  const script = doc.querySelector('head script:not([src])');
  assert(script, 'portal/' + old + '.html: has no redirect script');
  let went = null;
  new Function('window', script.textContent)({
    location: { search: '?w=2', hash: '#faq', replace: (u) => { went = u; } },
  });
  assert.equal(went, want + '?w=2#faq', 'portal/' + old + '.html should send the member to ' + want);
  assert(existsSync(new URL('../../' + fileFor(new URL(want, 'https://timerich.ai')), import.meta.url)),
    'portal/' + old + '.html: ' + want + ' is not a page');
  // For a browser with scripts off, and for anything that reads the head.
  assert.equal(doc.querySelector('meta[http-equiv="refresh"]').getAttribute('content'), '0; url=' + want);
  assert.equal(doc.querySelector('link[rel="canonical"]').getAttribute('href'), 'https://timerich.ai' + want);
}
// Nothing else is left at the old address but the images, which did not move.
const left = readdirSync(new URL('../../portal/', import.meta.url))
  .filter((f) => f !== 'assets' && !(f.replace(/\.html$/, '') in MOVED));
assert.deepEqual(left, [], 'portal/ should hold only the redirects and assets/');

console.log('Passed: ' + linksChecked + ' desktop/mobile/submenu links, rapid and modified clicks, Club frame target, the shared theme script on all ' + pages.length + ' pages, 9 old .html addresses tidying themselves, and ' + Object.keys(MOVED).length + ' old /portal addresses sending the member to /club.');
