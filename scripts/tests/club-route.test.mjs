// /club and /clubform: one address each.
//
// /club used to be two pages at one address. It served the public "Apply to
// the Time Rich Club" page to everyone, and for a member an inline script
// dropped a full-bleed iframe of /club/home over the top. That is gone. The
// public application form has an address of its own at /clubform, and /club
// is the member Club home itself: one document, the ordinary portal session
// gate on it, and a visitor without a session sent to /club/signin like on
// every other page inside.
//
// What this suite protects:
//   - the application form still works, and nothing on it reads a session;
//   - /club is a portal page, gated the way the others are;
//   - a signed-out visitor goes to the sign-in page, not round in a circle;
//   - the old addresses still land somewhere: /club/home redirects to /club;
//   - the frame is really gone, so nothing is left reaching for window.top;
//   - the day/night pill still works on the Club home.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

const FORM = read('clubform/index.html');
const CLUB = read('club/index.html');
const HOME = read('club/home.html');
const ACCESS = read('club/portal-access.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

/* ---- the application form, at its own address -------------------------- */

console.log('\nThe application form moved to /clubform, otherwise untouched');
{
  check('the form itself is still there', /<form/.test(FORM));
  check('and its endpoint with it', /FORM_ENDPOINT/.test(FORM));
  check('the body still opens straight onto the page',
    /<body>\s*\n\s*<nav>/.test(FORM),
    (FORM.match(/<body>[\s\S]{0,60}/) || [])[0]);

  // The gate is gone, not disabled: nothing on a public marketing page has
  // any business reading a member's session token.
  check('nothing reads the session token', !FORM.includes('tr_portal_session'));
  check('no frame is left behind', !FORM.includes('trp-club-frame'));
  check('and no member switch', !FORM.includes('data-trp-member'));

  check('it says /clubform is its own address',
    FORM.includes('<link rel="canonical" href="https://timerich.ai/clubform/" />'));
  check('and shares that address, not the old one',
    FORM.includes('content="https://timerich.ai/clubform/"') &&
    FORM.split('https://timerich.ai/club/').length === 1);

  // Driven, with a live session in storage: a member landing here gets the
  // form like anybody else, because there is nothing left to switch.
  const future = new Date(Date.now() + 86400e3).toISOString();
  const dom = new JSDOM(FORM, {
    url: 'https://timerich.ai/clubform',
    runScripts: 'dangerously',
    beforeParse(win) {
      const store = { tr_portal_session: JSON.stringify({ token: 't0ken', expires_at: future }) };
      Object.defineProperty(win, 'localStorage', {
        value: {
          getItem: (k) => (k in store ? store[k] : null),
          setItem: (k, v) => { store[k] = String(v); },
          removeItem: (k) => { delete store[k]; },
        },
      });
      win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
    },
  });
  const d = dom.window.document;
  check('a member with a session still gets the form',
    d.querySelector('form') !== null && d.getElementById('trp-club-frame') === null);
  check('and the page is not switched to anything else',
    !d.documentElement.hasAttribute('data-trp-member'));
}

/* ---- /club is the Club home ------------------------------------------- */

console.log('\n/club is the Club home, gated like every other portal page');
{
  check('it carries the session gate', /<html[^>]*data-trp-gate/.test(CLUB));
  check('and loads the gate script', CLUB.includes('portal-access.js'));
  check('with the portal config before it',
    CLUB.indexOf('portal-config.js') < CLUB.indexOf('portal-access.js'));

  /* The base target that broke links out of the frame is gone. What is there
     instead is a base href, and it is not a leftover: the Club home is the
     one portal page served from a directory address, so a browser at /club --
     before GitHub Pages has redirected to /club/ -- would resolve
     "portal.css" to /portal.css and get nothing. */
  check('no base target is left over', !/<base [^>]*target/.test(CLUB));
  check('and the base href keeps every relative link right at /club',
    /<base href="\/club\/"\/?>/.test(CLUB), (CLUB.match(/<base[^>]*>/) || [])[0]);
  check('it comes before anything that resolves a URL',
    CLUB.indexOf('<base') < CLUB.indexOf('<link rel="stylesheet"'));
  check('and no apply markup came with it',
    !CLUB.includes('FORM_ENDPOINT') && !CLUB.includes('trp-club-frame'));

  check('it is the Club home, not the apply page',
    CLUB.includes('<title>Time Rich Club</title>') && !CLUB.includes('Apply to the Time Rich Club'));
  check('and it is the page the Club menu item points at',
    /<a href="\/club" aria-current="page" class="trp-nav-link/.test(CLUB));
}

console.log('\nA visitor without a session is sent to the sign-in page');
{
  // The Club home has no login form of its own, so the gate redirects. The
  // address is relative, which from /club/ is /club/signin.
  check('signedOut() sends them to signin',
    /function signedOut\(\)[\s\S]*?window\.location\.replace\('signin'\);/.test(ACCESS),
    (ACCESS.match(/function signedOut\(\)[\s\S]*?\n  \}/) || [])[0]);
  check('and /club is no longer the destination for a refused session',
    !ACCESS.includes("window.top.location.replace('/club')"));

  // Nothing is left reaching for the top window. This is what would send a
  // member somewhere unexpected if a frame ever came back by accident.
  check('the frame helpers are gone', !/isFramed|leaveFrame/.test(ACCESS));
  check('signing out just reloads, and the gate does the rest',
    /signOut\(\);\s*\n\s*window\.location\.reload\(\);/.test(ACCESS));
  check('the theme no longer posts up to a parent',
    !read('club/portal-theme.js').includes('postMessage'));
}

console.log('\nClean addresses still work, and the old ones still land');
{
  check('tidyAddress is still there, taking .html off the bar',
    /function tidyAddress\(\)/.test(ACCESS) &&
    ACCESS.includes("loc.pathname.replace(/\\.html$/, '')"));
  check('and it is called before the DOM is waited on',
    ACCESS.indexOf('tidyAddress();') < ACCESS.indexOf("document.addEventListener('DOMContentLoaded', mount)"));

  check('/club/home redirects to /club', /window\.location\.replace\('\/club' \+/.test(HOME));
  check('keeping the query and the hash',
    HOME.includes('window.location.search + window.location.hash'));
  check('with a refresh for a browser with scripts off',
    /http-equiv="refresh" content="0; url=\/club"/.test(HOME));
  check('and it is kept out of the index', /name="robots" content="noindex"/.test(HOME));
}

console.log('\nThe way in, and the way back');
{
  const signin = read('club/signin.html');
  check('signing in lands on the curriculum',
    /window\.location\.replace\('\/club\/curriculum'\);/.test(signin),
    (signin.match(/window\.location\.replace\('[^']*'\)/g) || []));

  for (const page of ['dashboard', 'curriculum', 'sessions', 'resources', 'prompts', 'members']) {
    check(page + ' points its Club link at /club',
      read('club/' + page + '.html').includes('<a href="/club"'));
  }

  // Links meant for buyers go to the form; links meant for members stay on
  // /club. These three are the public pages that carried an Apply link.
  for (const [page, want] of [['call/index.html', 2], ['home/index.html', 2], ['brand/index.html', 1]]) {
    const html = read(page);
    const hits = (html.match(/\/clubform/g) || []).length;
    check(page + ' sends applicants to /clubform', hits >= want, hits);
    check(page + ' no longer sends them to /club',
      !/href="\/club\/"/.test(html) && !/href="https:\/\/timerich\.ai\/club"/.test(html),
      (html.match(/href="[^"]*timerich\.ai\/club[^f"]*"|href="\/club\/"/g) || []));
  }
}

/* ---- the day/night toggle, on the Club home ---------------------------- */

// Iltifat's sun/moon pill worked on every portal page except this one. The
// pill is drawn by portal-chrome.js and fires a `change` on the hidden
// <select>; the thing that listens for that change and writes the choice is
// one shared file now. This runs it for real, on the Club home.
console.log('\nThe day/night toggle works on the Club home');
{
  const CHROME = read('club/portal-chrome.js');
  const THEME = read('club/portal-theme.js');

  function club(store = {}) {
    const dom = new JSDOM(CLUB, {
      url: 'https://timerich.ai/club/',
      runScripts: 'outside-only',
      beforeParse(win) {
        Object.defineProperty(win, 'localStorage', {
          value: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: (k) => { delete store[k]; },
          },
        });
      },
    });
    const win = dom.window;
    win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

    // The pre-paint script in <head> runs first, as it does in the browser.
    const prepaint = [...win.document.querySelectorAll('script:not([src])')]
      .find((t) => t.textContent.includes("getItem('tr_portal_theme')"));
    win.eval(prepaint.textContent);

    win.eval(THEME);
    win.eval(CHROME);
    win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
    return { win, document: win.document, store };
  }

  check('the Club home loads the shared theme file rather than a copy of its own',
    /<script src="portal-theme\.js" defer><\/script>/.test(CLUB) &&
    !/localStorage\.setItem\('tr_portal_theme'/.test(CLUB));
  check('and it still sets the theme before first paint, inline',
    CLUB.indexOf("getItem('tr_portal_theme')") < CLUB.indexOf('<body'));

  const { win, document, store } = club();
  const pill = document.querySelector('button.trp-day-night');
  check('the pill is drawn here, the same as everywhere else', pill !== null);
  check('and it starts on the stored default',
    document.documentElement.getAttribute('data-theme') === 'system',
    document.documentElement.getAttribute('data-theme'));

  pill.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  check('clicking it switches to dark',
    document.documentElement.getAttribute('data-theme') === 'dark',
    document.documentElement.getAttribute('data-theme'));
  check('and the choice is written under the key every page reads',
    store.tr_portal_theme === 'dark', store);
  check('the hidden select carries the same value, so the two cannot drift',
    document.querySelector('[data-theme-select]').value === 'dark');

  pill.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  check('clicking again switches it back',
    document.documentElement.getAttribute('data-theme') === 'light' &&
    store.tr_portal_theme === 'light',
    [document.documentElement.getAttribute('data-theme'), store.tr_portal_theme]);

  pill.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const after = club(store);
  check('the choice survives a reload',
    after.document.documentElement.getAttribute('data-theme') === 'dark',
    after.document.documentElement.getAttribute('data-theme'));
  check('and the pill comes back showing it',
    after.document.querySelector('button.trp-day-night').getAttribute('aria-checked') === 'true');

  check('every portal page reads and writes the one key',
    ['index', 'dashboard', 'curriculum', 'sessions', 'resources', 'prompts', 'members', 'signin']
      .every((p) => read('club/' + p + '.html').includes("getItem('tr_portal_theme')")) &&
    /var KEY = 'tr_portal_theme';/.test(read('club/portal-theme.js')));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
