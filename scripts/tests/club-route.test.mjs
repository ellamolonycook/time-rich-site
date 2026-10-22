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
  check('pointed at the portal page', frame && frame.getAttribute('src') === '/portal/club.html');
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
  check('a rejected session goes that way rather than to the sign-in page',
    /} else if \(!leaveFrame\(\)\) \{\s*window\.location\.replace\('index\.html'\);/.test(ACCESS),
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
  const index = read('portal/index.html');
  check('signing in lands on /club',
    /window\.location\.replace\('\/club'\);/.test(index));
  check('the portal pages point their Club link at /club',
    read('portal/dashboard.html').includes('<a href="/club"'));
  check('portal/club.html is still served, and is what /club frames',
    CLUB.length > 0 && APPLY.includes("'/portal/club.html'"));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
