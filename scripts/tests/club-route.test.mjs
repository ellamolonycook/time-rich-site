// /club — two pages at one address.
//
// timerich.ai/club serves the public "Apply to the Time Rich Club" page to
// everyone, and the member Club home to anyone carrying a portal session.
// The site is static, so the choice is made in the browser: an inline script
// at the top of club/index.html reads the stored session and, for a member,
// drops a full-bleed iframe of /portal/club.html over the page.
//
// It is a frame rather than the same markup inlined because the Apply page
// styles bare body, h1, p, a, section, nav and footer — those rules would
// land on the Club home and restyle it. The frame boundary is what keeps
// the two apart, and this suite is mostly about the seams that creates.
//
// The property worth protecting above all others: a visitor without a
// session, which includes every crawler, must get the Apply page exactly as
// it was. So most of what follows checks that the gate does nothing.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

const APPLY = read('club/index.html');
const CLUB = read('portal/club.html');
const ACCESS = read('portal/portal-access.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

/* Loads club/index.html with a given localStorage, runs its scripts, and
   reports what the page decided. The Apply page pulls two tracking scripts
   and a pixel, so resources are left off: the gate is inline and runs
   without them. */
function open(storage) {
  const dom = new JSDOM(APPLY, {
    url: 'https://timerich.ai/club',
    runScripts: 'dangerously',
    beforeParse(win) {
      const store = Object.assign({}, storage);
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
  return dom;
}

/* The gate creates the frame on DOMContentLoaded, which has not fired by the
   time the JSDOM constructor returns, so every member case waits a tick. */
const tick = () => new Promise((r) => setTimeout(r, 0));

const future = new Date(Date.now() + 86400e3).toISOString();
const past = new Date(Date.now() - 86400e3).toISOString();
const session = (extra) => ({ tr_portal_session: JSON.stringify(Object.assign({ token: 't0ken', expires_at: future }, extra)) });

console.log('\nA visitor without a session gets the Apply page, untouched');
{
  for (const [what, storage] of [
    ['no session at all', {}],
    ['an expired session', { tr_portal_session: JSON.stringify({ token: 't', expires_at: past }) }],
    ['a session with no token', { tr_portal_session: JSON.stringify({ expires_at: future }) }],
    ['an empty token', { tr_portal_session: JSON.stringify({ token: '', expires_at: future }) }],
    ['unparseable storage', { tr_portal_session: 'not json' }],
  ]) {
    const d = open(storage).window.document;
    check(what + ': the page is not switched to the member view',
      !d.documentElement.hasAttribute('data-trp-member'));
    check(what + ': and no frame is created, so nothing is fetched',
      d.getElementById('trp-club-frame') === null);
  }

  // Storage that throws on every touch — private mode, blocked site data.
  {
    const dom = new JSDOM(APPLY, {
      url: 'https://timerich.ai/club',
      runScripts: 'dangerously',
      beforeParse(win) {
        Object.defineProperty(win, 'localStorage', {
          get() { throw new Error('blocked'); },
        });
      },
    });
    const d = dom.window.document;
    check('storage that throws: still the Apply page, no frame',
      !d.documentElement.hasAttribute('data-trp-member') &&
      d.getElementById('trp-club-frame') === null);
  }
}

console.log('\nThe Apply page itself is only added to, never edited');
{
  // The gate is additive. If this ever fails, something took copy or markup
  // out of a live marketing page.
  check('the apply form action is still there',
    /FORM_ENDPOINT|<form/.test(APPLY));
  check('the gate sits in <head>, above the page',
    APPLY.indexOf('trp-club-frame') < APPLY.indexOf('<body'));
  check('nothing in the body was wrapped or moved',
    /<body>\s*\n\s*<nav>/.test(APPLY),
    (APPLY.match(/<body>[\s\S]{0,60}/) || [])[0]);
  check('the frame is hidden by default, whatever the markup order',
    /#trp-club-frame\s*\{\s*display:\s*none/.test(APPLY));
  check('the member rule only matches under the attribute',
    /html\[data-trp-member\] #trp-club-frame/.test(APPLY));
  check('and the Apply markup is hidden, not removed',
    /html\[data-trp-member\] body > \*:not\(#trp-club-frame\)/.test(APPLY));
}

console.log('\nA member gets the Club home, in the frame');
{
  const dom = open(session());
  const d = dom.window.document;
  check('the page is switched to the member view before the body is parsed',
    d.documentElement.hasAttribute('data-trp-member'));
  await tick();

  const frame = d.getElementById('trp-club-frame');
  check('a frame is created', frame !== null);
  check('pointed at the portal page', frame && frame.getAttribute('src') === '/portal/club');
  check('and it is labelled for a screen reader',
    frame && frame.getAttribute('title') === 'Time Rich Club');
}

console.log('\nIf the frame never loads, the Apply page comes back');
{
  const dom = open(session());
  const win = dom.window;
  const d = win.document;
  await tick();
  check('the member view is on to begin with',
    d.documentElement.hasAttribute('data-trp-member'));

  // Nothing answered. Run the timers the gate armed.
  const frame = d.getElementById('trp-club-frame');
  frame.dispatchEvent(new win.Event('error'));

  check('an error on the frame puts Apply back',
    !d.documentElement.hasAttribute('data-trp-member'));
  check('and takes the frame out of the page',
    d.getElementById('trp-club-frame') === null);
}

console.log('\nLeaving the portal from inside the frame');
{
  // Only link and form navigation obeys a base target, so the two paths
  // that leave by script have to move the top window themselves.
  check('the Club home sets <base target="_top">',
    /<base target="_top"\/?>/.test(CLUB));
  check('and it is above everything that resolves a URL',
    CLUB.indexOf('<base') < CLUB.indexOf('<link'));

  check('portal-access.js can tell it is framed',
    /function isFramed\(\)/.test(ACCESS) && /window\.top !== window\.self/.test(ACCESS));
  check('and leaves by taking the TOP window to /club',
    /window\.top\.location\.replace\('\/club'\)/.test(ACCESS));
  // The sign-in page is "./" rather than "index.html" now: every address in
  // the portal is extensionless, and this one is the directory itself.
  check('a rejected session goes that way rather than to the sign-in page',
    /} else if \(!leaveFrame\(\)\) \{[\s\S]{0,120}?window\.location\.replace\('\.\/'\);/.test(ACCESS),
    (ACCESS.match(/function signedOut\(\)[\s\S]*?\n  \}/) || [])[0]);
  check('and so does signing out, instead of reloading the frame',
    /if \(!leaveFrame\(\)\) window\.location\.reload\(\);/.test(ACCESS));
  // /club is the right destination: it shows Apply to anyone without a
  // session, and signOut() has already cleared the token, so the gate on
  // that page reads "visitor" and there is no loop back into the frame.
  check('the token is cleared before either of those',
    /clearCode\(\);/.test(ACCESS) && ACCESS.indexOf('function signOut()') < ACCESS.indexOf('clearMembersLinkCache();'));

  check('Club links use native navigation without a competing scripted fade',
    !CLUB.includes('data-trp-leaving'));
}

console.log('\nThe way in, and the way back');
{
  /* Signing in used to land on /club. It lands on the curriculum now --
     13ab847, "Open the Accelerator on the curriculum instead of the
     dashboard" -- and this had been left asserting the old destination ever
     since, which failed the suite and stopped every file after it from
     running at all. It follows the code, on the extensionless address. */
  const index = read('portal/index.html');
  check('signing in lands on the curriculum',
    /window\.location\.replace\('\/portal\/curriculum'\);/.test(index),
    (index.match(/window\.location\.replace\('[^']*'\)/g) || []));
  check('the portal pages point their Club link at /club',
    read('portal/dashboard.html').includes('<a href="/club"'));
  // The file is still portal/club.html; the address it is framed at is not.
  check('portal/club.html is still served, and is what /club frames',
    CLUB.length > 0 && APPLY.includes("'/portal/club'"));
}

/* ---- the day/night toggle, on Club ------------------------------------- */

// Iltifat's sun/moon pill worked on every portal page except this one. The
// pill is drawn by portal-chrome.js and fires a `change` on the hidden
// <select>; the thing that listens for that change and writes the choice was
// copied into the foot of seven pages by hand, and Club never got the copy.
// So on Club, and only on Club, clicking the pill did nothing at all.
//
// The listener is one shared file now. This runs it for real, on the Club
// page, rather than reading the source for it.
console.log('\nThe day/night toggle works on Club');
{
  const CHROME = read('portal/portal-chrome.js');
  const THEME = read('portal/portal-theme.js');

  /* The Club page in a window, with the two scripts it loads evaluated in
     the order the browser runs them. Storage is a plain object the test can
     look inside, which is also how the reload below is done. */
  function club(store = {}) {
    const dom = new JSDOM(CLUB, {
      url: 'https://timerich.ai/portal/club.html',
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
    win.posted = [];
    win.parent = { postMessage: (data, origin) => win.posted.push({ data, origin }) };

    // The pre-paint script in <head> runs first, as it does in the browser.
    const prepaint = [...win.document.querySelectorAll('script:not([src])')]
      .find((t) => t.textContent.includes("getItem('tr_portal_theme')"));
    win.eval(prepaint.textContent);

    win.eval(THEME);
    win.eval(CHROME);
    win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
    return { win, document: win.document, store };
  }

  check('Club loads the shared theme file rather than a copy of its own',
    /<script src="portal-theme\.js" defer><\/script>/.test(CLUB) &&
    !/localStorage\.setItem\('tr_portal_theme'/.test(CLUB));
  check('and it still sets the theme before first paint, inline',
    CLUB.indexOf("getItem('tr_portal_theme')") < CLUB.indexOf('<body'));

  const { win, document, store } = club();
  const pill = document.querySelector('button.trp-day-night');
  check('the pill is drawn on Club, the same as everywhere else', pill !== null);
  check('and it starts on the stored default',
    document.documentElement.getAttribute('data-theme') === 'system',
    document.documentElement.getAttribute('data-theme'));

  pill.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  check('clicking it switches Club to dark',
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

  // The reload: the same storage, a brand new page.
  pill.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const after = club(store);
  check('the choice survives a reload',
    after.document.documentElement.getAttribute('data-theme') === 'dark',
    after.document.documentElement.getAttribute('data-theme'));
  check('and the pill comes back showing it',
    after.document.querySelector('button.trp-day-night').getAttribute('aria-checked') === 'true');

  // The same storage key is what keeps Club in step with the rest.
  check('every portal page reads and writes the one key',
    ['dashboard', 'curriculum', 'sessions', 'resources', 'prompts', 'members', 'index']
      .every((p) => read('portal/' + p + '.html').includes("getItem('tr_portal_theme')")) &&
    /var KEY = 'tr_portal_theme';/.test(read('portal/portal-theme.js')));
}

console.log('\nThe frame follows the choice made inside it');
{
  // /club paints the iframe element itself in the theme's ground colour, so a
  // dark-theme member does not get a white rectangle while the Club home
  // loads. That colour was read once, when the frame was made, so a choice
  // made inside the frame afterwards left it stale. The framed page posts the
  // new theme up; the outer page repaints.
  const THEME = read('portal/portal-theme.js');
  check('the framed page tells its parent when the theme changes',
    /window\.top !== window\.self/.test(THEME) &&
    /postMessage\(\{ type: 'trportal:theme', theme: value \}, window\.location\.origin\)/.test(THEME));
  check('and only to its own origin', /window\.location\.origin\)/.test(THEME));

  check('the outer page listens for exactly that message',
    /data\.type !== 'trportal:theme'/.test(APPLY));
  check('and refuses one from anywhere else',
    /if \(event\.origin !== window\.location\.origin\) return;/.test(APPLY));
  check('repainting the frame rather than reading storage again',
    /function paint\(theme\)/.test(APPLY) &&
    /frame\.style\.background = dark \? '#1C1D1A' : '#FFFDFB';/.test(APPLY));
  check('the first paint still comes from what was stored',
    /paint\(stored\(\)\);/.test(APPLY));

  // Driven: a member with a session, the frame up, then the message.
  const dom = open(session());
  const win = dom.window;
  await tick();
  const frame = win.document.getElementById('trp-club-frame');
  check('the frame starts on the light ground',
    /255, ?253, ?251|#FFFDFB/i.test(frame.style.background), frame.style.background);

  const post = (theme, origin) => win.dispatchEvent(new win.MessageEvent('message', {
    data: { type: 'trportal:theme', theme: theme },
    origin: origin,
  }));

  post('dark', 'https://timerich.ai');
  check('the message from inside the frame repaints it dark',
    /28, ?29, ?26|#1C1D1A/i.test(frame.style.background), frame.style.background);

  post('light', 'https://evil.example');
  check('a message from another origin is ignored',
    /28, ?29, ?26|#1C1D1A/i.test(frame.style.background), frame.style.background);

  post('light', 'https://timerich.ai');
  check('and switching back repaints it light',
    /255, ?253, ?251|#FFFDFB/i.test(frame.style.background), frame.style.background);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
