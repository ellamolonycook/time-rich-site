// Time Rich Members page tests.
//
// The cohort directory is parked: the page is a Coming soon preview until the
// directory opens, so what this suite pins is that the page says so, that it
// sends the member to the Superhuman WhatsApp group in the meantime, that it
// no longer reaches for the Worker or offers a search box, and that it is
// still a portal page (header, nav, footer) rather than a bare notice.
//
// The second half is unchanged and is not about this page at all: it is the
// hidden Members link on the other four pages and the back button after
// signing out, both driven by the real club/portal-access.js.
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('../../club/members.html', import.meta.url), 'utf8');
const DIRECTORY_URL = 'https://worker.test/portal-directory';

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  -> ' + JSON.stringify(extra) : '')); }
}

// Loads the page with a signed-in session and a fetch that records every call
// it is handed. Nothing on this page should make one.
async function open({ code = 'ABCDE-FGHJK' } = {}) {
  const requests = [];
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => errors.push(String(e && e.message)));
  const dom = new JSDOM(HTML, {
    url: 'https://timerich.ai/club/members.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.tailwind = {};
      window.gtag = () => {};
      window.TR_PORTAL_CONFIG = { directoryUrl: DIRECTORY_URL,
        sessionUrl: 'https://worker.test/portal-session',
        loginUrl: 'https://worker.test/portal-login',
        logoutUrl: 'https://worker.test/portal-logout' };
      if (code) window.localStorage.setItem('tr_portal_session',
        JSON.stringify({ token: code, expires_at: new Date(Date.now() + 30 * 864e5).toISOString() }));
      window.fetch = (url, init = {}) => {
        requests.push({ url: String(url), init });
        return Promise.resolve(new window.Response('{}', { status: 200 }));
      };
      window.Response = globalThis.Response;
    },
  });
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
  return { dom, doc: dom.window.document, requests, errors };
}

console.log('\nTime Rich Members page — Coming soon');
{
  const page = await open();
  const main = page.doc.querySelector('main');
  const text = main.textContent.replace(/\s+/g, ' ').trim();

  const section = main.querySelector('section.members-preview');
  check('one preview section holds it', section !== null);
  // Guarded: with no section the lines below would throw, and a suite that
  // dies halfway reports far less than it knows.
  const scope = section || page.doc.createElement('section');

  const badge = scope.querySelector('.members-preview-badge') || page.doc.createElement('span');
  check('it is labelled Coming soon', badge.textContent.trim() === 'Coming soon', badge.textContent);

  // The heading is still the page's own, with the brand stop in its own span.
  const h1 = page.doc.querySelector('main h1') || page.doc.createElement('h1');
  const stop = h1.querySelector('.trp-stop');
  check('the heading says the directory is on its way',
    /directory is on its way/.test(h1.textContent), h1.textContent.trim());
  check('and it ends with the brand stop',
    stop !== null && stop.textContent === '.', stop && stop.textContent);
  check('the section is labelled by the sentence, not left unnamed',
    main.querySelector('section[aria-labelledby="members-soon"]') !== null &&
    page.doc.getElementById('members-soon') !== null);

  // Until the directory opens the cohort is on WhatsApp, and it is the
  // Superhuman group, not the Time Rich Club one, which is a different room.
  check('the copy sends the member to WhatsApp in the meantime',
    text.includes('the cohort lives on WhatsApp'), text);

  const links = [...scope.querySelectorAll('a[href]')];
  const wa = links.filter((a) => /chat\.whatsapp\.com/.test(a.getAttribute('href')));
  check('exactly one WhatsApp link, and it is the Superhuman group',
    wa.length === 1 && /E5GU1dvuHhFDI77yO88OIw/.test(wa[0].getAttribute('href')),
    wa.map((a) => a.getAttribute('href')));
  const join = wa[0] || page.doc.createElement('a');
  check('the button says which group it is',
    join.textContent.replace(/\s+/g, ' ').trim() === 'Join the Superhuman WhatsApp',
    join.textContent.trim());
  check('it opens in a new tab, with the tab it came from sealed off',
    join.getAttribute('target') === '_blank' &&
    /\bnoopener\b/.test(join.getAttribute('rel') || '') &&
    /\bnoreferrer\b/.test(join.getAttribute('rel') || ''),
    [join.getAttribute('target'), join.getAttribute('rel')]);
  check('and the quiet line says when the group opens',
    text.includes('The group opens on Saturday 24 October.'), text);

  const club = links.filter((a) => a.textContent.trim() === 'Back to Club');
  check('Back to Club goes to the Club page',
    club.length === 1 && club[0].getAttribute('href') === '/club',
    club.map((a) => a.getAttribute('href')));

  // The four blank cards are a picture of the directory, not content: a
  // screen reader reading out twelve empty lines would be noise.
  const grid = scope.querySelector('.members-preview-grid') || page.doc.createElement('div');
  check('the skeleton grid is hidden from screen readers',
    grid.getAttribute('aria-hidden') === 'true', grid.getAttribute('aria-hidden'));
  check('and it is a grid of cards rather than one empty box',
    grid.querySelectorAll('.members-preview-card').length === 4,
    grid.querySelectorAll('.members-preview-card').length);

  // Purple is the Soon colour in this portal. The badge may use it; the
  // blank avatars are decoration and may not.
  const styles = [...HTML.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const avatarRules = styles
    .split('}')
    .filter((rule) => /members-preview-avatar/.test(rule.split('{')[0] || ''));
  check('no plum in the avatar rules: purple is reserved for Soon',
    avatarRules.length > 0 && avatarRules.every((rule) => !/plum/.test(rule)),
    avatarRules.filter((rule) => /plum/.test(rule)));
}

console.log('\nTime Rich Members page — what is gone');
{
  const page = await open();

  check('no search box',
    page.doc.querySelector('input[type="search"]') === null &&
    page.doc.getElementById('members-search') === null);
  check('no directory grid and no profile cards',
    page.doc.getElementById('members-grid') === null &&
    page.doc.querySelector('.member-card') === null);
  // The phone menu is a dialog too, so this asks about the profile one by
  // name rather than counting dialogs.
  check('no profile pop-up left behind',
    page.doc.querySelector('.member-modal') === null &&
    page.doc.querySelector('[data-member-index]') === null &&
    [...page.doc.querySelectorAll('[role="dialog"]')]
      .every((d) => d.getAttribute('aria-label') === 'Menu'));

  // The page used to POST to the Worker on every load. A Coming soon page
  // that still did that would be one request per visit for an empty answer.
  check('the directory Worker route is never called',
    page.requests.filter((r) => r.url === DIRECTORY_URL).length === 0,
    page.requests.map((r) => r.url));
  check('no script errors on the page', page.errors.length === 0, page.errors);
}

console.log('\nTime Rich Members page — still a portal page');
{
  const page = await open();
  check('the header is there, with the nav',
    page.doc.querySelector('header#top-nav') !== null &&
    page.doc.querySelector('nav[aria-label="Portal"]') !== null);
  check('Members is marked as the current page in the nav',
    page.doc.querySelector('nav a[href="members"][aria-current="page"]') !== null);
  check('the footer line is there',
    page.doc.querySelector('footer .trp-foot') !== null);
  check('and the theme control is still the one every page has',
    page.doc.querySelector('[data-theme-select]') !== null);
}

console.log('\nTime Rich Members page — copy');
{
  const main = HTML.split('<main')[1].split('</main>')[0];
  check('no em dashes or exclamation marks in the page copy',
    !/—/.test(main) && !/[A-Za-z]!/.test(main.replace(/!==|!=|!\w|\(!/g, '')));
  // "Founder / CEO" and the like: a slash is not a layout. Comments, inline
  // styles and inline scripts come out first: a stylesheet is full of slashes
  // and none of them are on screen.
  const visible = main
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
  check('no slash used as a separator in anything on screen',
    !visible.includes('/'), (visible.match(/.{0,30}\/.{0,30}/) || [])[0]);
  check('no stray merge text carried over from the shell', !HTML.includes('origin/main'));
}

// ---------------------------------------------------------------------------
// The hidden "Members" link on the other portal pages, driven by the real
// club/portal-access.js.
// ---------------------------------------------------------------------------
const ACCESS_JS = readFileSync(new URL('../../club/portal-access.js', import.meta.url), 'utf8');
// sessions is not here: Live Sessions is gone and club/sessions.html is a
// redirect to the Curriculum, with no menu on it.
const PAGES = ['dashboard', 'curriculum', 'resources'];

async function openPortalPage(name, { directoryStatus = 200, cache, directoryThrows = false, holdDirectory = false } = {}) {
  const html = readFileSync(new URL(`../../club/${name}.html`, import.meta.url), 'utf8');
  const calls = [];
  let held = null;   // set when holdDirectory keeps the answer pending
  const dom = new JSDOM(html, {
    url: `https://timerich.ai/club/${name}.html`,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),   // the shells' own scripts are not under test here
    beforeParse(window) {
      window.tailwind = {};
      window.gtag = () => {};
      window.TR_PORTAL_CONFIG = { directoryUrl: DIRECTORY_URL,
        sessionUrl: 'https://worker.test/portal-session',
        loginUrl: 'https://worker.test/portal-login',
        logoutUrl: 'https://worker.test/portal-logout' };
      window.localStorage.setItem('tr_portal_session', JSON.stringify({ token: 'tok-ABCDE', expires_at: new Date(Date.now() + 30 * 864e5).toISOString() }));
      if (cache) window.localStorage.setItem('tr_members_link', JSON.stringify(cache));
      window.fetch = (url, init = {}) => {
        url = String(url);
        calls.push(url);
        if (url.includes('/portal-session') || url.includes('/rpc/portal_get')) {
          return Promise.resolve(new globalThis.Response(JSON.stringify({ ok: true, member: { first_name: 'Ada', role: 'buyer' }, weeks: [], sessions: [] }), { status: 200 }));
        }
        if (url === DIRECTORY_URL) {
          if (directoryThrows) return Promise.reject(new Error('offline'));
          if (holdDirectory) return new Promise((resolve) => { held = resolve; });
          return Promise.resolve(new globalThis.Response(JSON.stringify({ profiles: [] }), { status: directoryStatus }));
        }
        return Promise.resolve(new globalThis.Response('{}', { status: 200 }));
      };
    },
  });
  dom.window.eval(ACCESS_JS);
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
  const links = [...dom.window.document.querySelectorAll('[data-portal-members-link]')];
  const release = async (status) => {
    if (held) held(new globalThis.Response(JSON.stringify({ profiles: [] }), { status }));
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
  };
  return { dom, links, calls, release, directoryCalls: () => calls.filter((u) => u === DIRECTORY_URL).length };
}

// Members is in the menu for everyone now, carrying a purple Soon pill. The
// directory itself has not opened; what changed is the way in. The link used
// to be hidden in the markup and revealed only when the Worker said this
// member could see the directory.
//
// portal-access.js is untouched. It still asks, still remembers the answer
// for ten minutes and still toggles [hidden] and [data-pending] on the link,
// and every assertion below about that is the one it always was. What is
// gone is the pair of rules in portal-content.css that made [hidden] mean
// anything here — so the answer no longer decides whether the link shows,
// and the gate can be switched back on by restoring two rules rather than by
// rebuilding any of this.
console.log('\nMembers nav link on the other portal pages');
for (const name of PAGES) {
  const html = readFileSync(new URL(`../../club/${name}.html`, import.meta.url), 'utf8');
  // The link is extensionless now; club/members.html is still the file
  // behind it, and still served, so an old bookmark keeps working.
  const raw = [...html.matchAll(/<a href="members"([^>]*)>/g)].map((m) => m[1]);
  check(name + '.html: a Members link in the top nav and the phone menu, neither hidden',
    raw.length === 2 && raw.every((attrs) => !/\shidden(\s|$)/.test(attrs)), raw);
  check(name + '.html: the attribute stays, so portal-access.js still finds them',
    raw.length === 2 && raw.every((attrs) => /data-portal-members-link/.test(attrs)), raw);
  check(name + '.html: both carry a Soon pill',
    (html.match(/<span class="trp-soon[^"]*">Soon<\/span>/g) || []).length === 2);
}
{
  const css = readFileSync(new URL('../../club/portal-content.css', import.meta.url), 'utf8');
  check('the stylesheet no longer hides the link on [hidden]',
    !/\[data-portal-members-link\]\[hidden\]\s*\{\s*display:\s*none/.test(css),
    (css.match(/\[data-portal-members-link\]\[hidden\][^}]*\}/) || [])[0]);

  const closed = await openPortalPage('dashboard', { directoryStatus: 403 });
  check('directory 403 (switched off, a buyer): the link stays hidden',
    closed.links.length === 2 && closed.links.every((a) => a.hidden), closed.links.map((a) => a.hidden));
  check('the session token is sent to the directory with POST', closed.directoryCalls() === 1);
  check('a 403 is remembered, as "hidden"',
    JSON.parse(closed.dom.window.localStorage.getItem('tr_members_link')).ok === false);

  const open200 = await openPortalPage('curriculum', { directoryStatus: 200 });
  check('directory 200 (switched on, or team): the link is shown', open200.links.every((a) => !a.hidden));

  const cached = await openPortalPage('prompts', { cache: { ok: true, at: Date.now() } });
  check('a recent answer is reused: no extra call, link shown', cached.directoryCalls() === 0 && cached.links.every((a) => !a.hidden));

  const stale = await openPortalPage('dashboard', { cache: { ok: true, at: Date.now() - 11 * 60 * 1000 }, directoryStatus: 403 });
  check('an answer older than ten minutes is asked again', stale.directoryCalls() === 1 && stale.links.every((a) => a.hidden));

  const down = await openPortalPage('resources', { directoryStatus: 500 });
  check('Worker error: link hidden and nothing remembered, so the next page asks again',
    down.links.every((a) => a.hidden) && down.dom.window.localStorage.getItem('tr_members_link') === null);

  const offline = await openPortalPage('dashboard', { directoryThrows: true });
  check('network failure: link hidden', offline.links.every((a) => a.hidden));

  // The top nav is centred, so a fifth link arriving after the Worker answers
  // used to shove the other four sideways. With nothing remembered the link
  // keeps its box while the answer is in flight.
  {
    const css = readFileSync(new URL('../../club/portal-content.css', import.meta.url), 'utf8');
    check('nor blanks it while the answer is in flight',
      !/\[data-portal-members-link\]\[data-pending\]\s*\{\s*visibility:\s*hidden/.test(css),
      (css.match(/\[data-portal-members-link\]\[data-pending\][^}]*\}/) || [])[0]);

    const slow = await openPortalPage('dashboard', { holdDirectory: true });
    check('while the answer is in flight the link is not hidden, just unpainted',
      slow.links.length === 2 &&
      slow.links.every((a) => !a.hidden && a.hasAttribute('data-pending')),
      slow.links.map((a) => [a.hidden, a.getAttribute('data-pending')]));

    await slow.release(200);
    check('once the answer lands the box is kept and the link paints',
      slow.links.every((a) => !a.hidden && !a.hasAttribute('data-pending')),
      slow.links.map((a) => [a.hidden, a.getAttribute('data-pending')]));

    const slowNo = await openPortalPage('curriculum', { holdDirectory: true });
    await slowNo.release(403);
    check('a 403 takes the box away again',
      slowNo.links.every((a) => a.hidden && !a.hasAttribute('data-pending')));

    // A remembered answer is applied before any request, so there is no
    // reserved box and nothing moves at all.
    const remembered = await openPortalPage('prompts', { cache: { ok: true, at: Date.now() } });
    check('a remembered answer never reserves anything',
      remembered.links.every((a) => !a.hidden && !a.hasAttribute('data-pending')));
  }

  open200.dom.window.TRPortal.signOut();
  check('signing out forgets the remembered answer', open200.dom.window.localStorage.getItem('tr_members_link') === null);
}

// ---------------------------------------------------------------------------
// Signing out and pressing Back. The page comes back from the back-forward
// cache with nothing re-run, so the gate is asked again on pageshow.
// ---------------------------------------------------------------------------
console.log('\n' + 'The back button after signing out');
{
  // location.replace is read only in jsdom, and calling it raises a
  // "Not implemented: navigation" jsdomError. That error is the signal that
  // the page tried to leave, so it is collected rather than swallowed.
  const openGated = async ({ signedIn }) => {
    const html = readFileSync(new URL('../../club/dashboard.html', import.meta.url), 'utf8');
    const left = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', (e) => { if (/navigation/i.test(e.message)) left.push(e.message); });
    const dom = new JSDOM(html, {
      url: 'https://timerich.ai/club/dashboard.html',
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      virtualConsole: vc,
      beforeParse(window) {
        window.tailwind = {};
        window.gtag = () => {};
        window.TR_PORTAL_CONFIG = { directoryUrl: DIRECTORY_URL,
          sessionUrl: 'https://worker.test/portal-session',
          loginUrl: 'https://worker.test/portal-login',
          logoutUrl: 'https://worker.test/portal-logout' };
        if (signedIn) {
          window.localStorage.setItem('tr_portal_session', JSON.stringify({ token: 'tok-ABCDE', expires_at: new Date(Date.now() + 30 * 864e5).toISOString() }));
        }
        window.fetch = () => Promise.resolve(new globalThis.Response(JSON.stringify({ ok: true, member: { first_name: 'Ada', role: 'buyer' }, weeks: [], sessions: [] }), { status: 200 }));
      },
    });
    dom.window.eval(ACCESS_JS);
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
    dom.left = left;
    return dom;
  };

  // A page coming back from the back-forward cache fires pageshow with
  // persisted true. A normal load fires it with persisted false.
  const restore = (dom, persisted) => {
    const event = new dom.window.Event('pageshow');
    Object.defineProperty(event, 'persisted', { value: persisted });
    dom.window.dispatchEvent(event);
  };

  const live = await openGated({ signedIn: true });
  live.left.length = 0;
  restore(live, true);
  check('a restored page with a session is left alone', live.left.length === 0, live.left);

  // What Ella actually did: sign out, then press Back.
  live.window.TRPortal.signOut();
  restore(live, true);
  check('a restored page with no session goes back to sign-in',
    live.left.length === 1, live.left);

  const fresh = await openGated({ signedIn: true });
  fresh.window.TRPortal.signOut();
  fresh.left.length = 0;
  restore(fresh, false);
  check('a normal load is not touched, it has already been through the gate',
    fresh.left.length === 0, fresh.left);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
