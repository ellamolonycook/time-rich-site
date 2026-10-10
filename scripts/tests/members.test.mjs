// Time Rich Members page tests: load portal/members.html in jsdom with a fake
// Worker, then drive it the way a member would.
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('../../portal/members.html', import.meta.url), 'utf8');
const DIRECTORY_URL = 'https://worker.test/portal-directory';

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  -> ' + JSON.stringify(extra) : '')); }
}

const PROFILES = [
  { name: 'Ada Lovelace', hook_line: 'First programmer', title: 'Founder', company: 'Analytical Co',
    company_does: 'Engines that compute.', who_they_serve: 'Founders.', superpower: 'Systems thinking',
    linkedin: 'https://www.linkedin.com/in/ada', instagram: null, other_links: [], photo_url: 'https://sb.test/storage/v1/object/sign/portal-directory/ada.jpg?token=t' },
  { name: 'Cher', hook_line: 'One name is enough', title: '', company: 'Solo Studio',
    superpower: 'Stage presence', linkedin: null, instagram: null, other_links: [], photo_url: null },
  { name: 'Grace Hopper', hook_line: 'Debugger in chief', title: 'Admiral', company: 'Navy Labs',
    superpower: 'Compilers', linkedin: 'https://www.linkedin.com/in/grace', instagram: null, other_links: [], photo_url: 'http://insecure.test/grace.jpg' },
  { name: '<img src=x onerror="window.pwned=1">', hook_line: '<b>bold?</b>', title: 'Tester', company: 'XSS Inc',
    superpower: 'Breaking things', linkedin: null, instagram: null, other_links: [], photo_url: null },
];

// Loads the page with a fake Worker. `reply` is { status, body }.
async function open({ reply = { status: 200, body: { profiles: PROFILES } }, code = 'ABCDE-FGHJK' } = {}) {
  const requests = [];
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => errors.push(String(e && e.message)));
  const dom = new JSDOM(HTML, {
    url: 'https://timerich.ai/portal/members.html',
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
      // What the portal keeps since sign-in became an email: a session
      // token and its expiry, not the address and not a passcode.
      if (code) window.localStorage.setItem('tr_portal_session',
        JSON.stringify({ token: code, expires_at: new Date(Date.now() + 30 * 864e5).toISOString() }));
      window.fetch = (url, init = {}) => {
        requests.push({ url: String(url), init });
        return Promise.resolve(new window.Response(JSON.stringify(reply.body), { status: reply.status }));
      };
      window.Response = globalThis.Response;
    },
  });
  // Let DOMContentLoaded, the fetch and the render settle.
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
  const doc = dom.window.document;
  return {
    dom, doc, requests, errors,
    grid: doc.getElementById('members-grid'),
    status: doc.getElementById('members-status'),
    search: doc.getElementById('members-search'),
    cards: () => [...doc.querySelectorAll('#members-grid .member-card')],
    visibleNames: () => [...doc.querySelectorAll('#members-grid li')]
      .filter((li) => !li.hidden).map((li) => li.querySelector('.member-name').textContent),
    type(value) {
      this.search.value = value;
      this.search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    },
  };
}

console.log('\nTime Rich Members page — loading');
{
  const page = await open();
  const req = page.requests.find((r) => r.url === DIRECTORY_URL);
  check('asks the Worker once, with POST and the stored session token',
    page.requests.filter((r) => r.url === DIRECTORY_URL).length === 1 && req.init.method === 'POST' &&
    JSON.parse(req.init.body).token === 'ABCDE-FGHJK', page.requests.map((r) => r.url));
  check('draws one card per profile, in the order the Worker sent', page.cards().length === 4 &&
    page.visibleNames().join('|') === PROFILES.map((p) => p.name).join('|'), page.visibleNames());
  check('the loading line is gone once cards are shown', page.status.hidden === true && !page.grid.hidden);
  check('search is enabled once members are loaded', page.search.disabled === false);

  const [ada, cher, grace, xss] = page.cards();
  check('a card shows name, hook line, then title and company',
    ada.querySelector('.member-name').textContent === 'Ada Lovelace' &&
    ada.querySelector('.member-hook').textContent === 'First programmer' &&
    ada.querySelector('.member-meta').textContent === 'Founder · Analytical Co');
  check('company alone when there is no title', cher.querySelector('.member-meta').textContent === 'Solo Studio');
  check('cards are buttons, so they work from the keyboard', ada.tagName === 'BUTTON' && ada.type === 'button');

  const img = ada.querySelector('img.member-photo');
  check('an https photo is shown as an image', Boolean(img) && img.getAttribute('src') === PROFILES[0].photo_url);
  check('the photo is decorative next to the name (empty alt) and lazy',
    img && img.getAttribute('alt') === '' && img.getAttribute('loading') === 'lazy');
  check('no photo: initials on sage instead', cher.querySelector('.member-initials')?.textContent === 'C' && !cher.querySelector('img'));
  check('a non-https photo URL is never loaded: initials instead',
    !grace.querySelector('img') && grace.querySelector('.member-initials')?.textContent === 'GH');

  img.dispatchEvent(new page.dom.window.Event('error'));
  check('a photo that fails to load (expired link) turns into initials',
    !ada.querySelector('img') && ada.querySelector('.member-initials')?.textContent === 'AL');

  check('typed markup stays text: no injected image, nothing ran',
    xss.querySelector('.member-name').textContent === PROFILES[3].name && !xss.querySelector('.member-name img') &&
    !xss.querySelector('b') && page.dom.window.pwned === undefined);
  check('no script errors on the page', page.errors.length === 0, page.errors);
}

console.log('\nTime Rich Members page — search');
{
  const page = await open();
  page.type('ada');
  check('matches on name, ignoring case', page.visibleNames().join('|') === 'Ada Lovelace', page.visibleNames());
  page.type('NAVY');
  check('matches on company', page.visibleNames().join('|') === 'Grace Hopper', page.visibleNames());
  page.type('stage presence');
  check('matches on superpower', page.visibleNames().join('|') === 'Cher', page.visibleNames());
  page.type('Debugger');
  check('does not match on hook line (name, company and superpower only)', page.visibleNames().length === 0);
  check('no match: says so', !page.status.hidden && /No one matches/.test(page.status.textContent), page.status.textContent);
  page.type('');
  check('clearing the search shows everyone again and hides the message',
    page.visibleNames().length === 4 && page.status.hidden);
}

console.log('\nTime Rich Members page — profile pop-up');
{
  const FULL = {
    name: 'Ella Molony Cook', hook_line: "4x founder · 1 exit · Let's get into good trouble",
    title: 'Founder and CEO', company: 'Time Rich',
    company_does: 'An AI education platform and founder community.',
    who_they_serve: 'Founders, operators and creators.',
    superpower: 'Connector + systems + delegation.',
    linkedin: 'https://www.linkedin.com/in/ellamolonycook/', instagram: 'https://www.instagram.com/timerichtalk',
    other_links: ['https://timerichclub.com', 'javascript:alert(1)'],
    photo_url: 'https://sb.test/storage/v1/object/sign/portal-directory/ella.jpg?token=t',
  };
  const page = await open({ reply: { status: 200, body: { profiles: [FULL, PROFILES[1]] } } });
  const { doc, dom } = page;
  const key = (k, extra = {}) => doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true, ...extra }));

  check('no pop-up before a click', !doc.getElementById('member-modal') || doc.getElementById('member-modal').hidden);
  const card = page.cards()[0];
  card.focus();
  card.click();
  const modal = doc.getElementById('member-modal');
  const panel = modal && modal.querySelector('[role="dialog"]');
  check('clicking a card opens a pop-up over the grid (not a new page)',
    modal && !modal.hidden && dom.window.location.pathname === '/portal/members.html');
  check('it lives on <body>, above the portal header', modal && modal.parentNode === doc.body);
  check('it is a labelled modal dialog',
    panel && panel.getAttribute('aria-modal') === 'true' && doc.getElementById(panel.getAttribute('aria-labelledby'))?.textContent === 'Ella Molony Cook');

  const order = [...panel.querySelectorAll('img.member-photo, .member-initials, .member-profile-name, .member-profile-hook, .member-profile-meta, .member-profile-section h3, .member-profile-links')]
    .map((n) => n.classList.contains('member-photo') || n.classList.contains('member-initials') ? 'photo'
      : n.classList.contains('member-profile-name') ? 'name'
      : n.classList.contains('member-profile-hook') ? 'hook'
      : n.classList.contains('member-profile-meta') ? 'title+company'
      : n.classList.contains('member-profile-links') ? 'links'
      : n.textContent);
  check('fields follow the brief: photo, name, hook, title and company, what the company does, who they serve, superpower, links',
    order.join(' > ') === 'photo > name > hook > title+company > What Time Rich does > Who they serve > Superpower > links', order);
  check('title and company read as one line', panel.querySelector('.member-profile-meta').textContent === 'Founder and CEO · Time Rich');

  const linkedin = panel.querySelector('a.member-linkedin');
  check('LinkedIn is the primary button and opens in a new tab safely',
    linkedin && linkedin.href === FULL.linkedin && linkedin.textContent.trim() === 'LinkedIn' &&
    linkedin.target === '_blank' && linkedin.rel === 'noopener noreferrer');
  const icons = [...panel.querySelectorAll('a.member-icon-link')];
  check('Instagram and other links are small icon links with readable labels',
    icons.length === 2 && icons[0].href === FULL.instagram && icons[0].getAttribute('aria-label') === 'Ella Molony Cook on Instagram' &&
    icons[1].getAttribute('aria-label') === 'timerichclub.com', icons.map((a) => a.getAttribute('aria-label')));
  check('a non-https link is never turned into a link', !panel.querySelector('a[href^="javascript:"]'));
  check('no contact form and no message box', !panel.querySelector('form, textarea, input'));

  const close = panel.querySelector('.member-modal-close');
  check('focus moves into the pop-up, on the close button', doc.activeElement === close);
  const focusables = [...panel.querySelectorAll('a[href], button')];
  focusables[focusables.length - 1].focus();
  key('Tab');
  check('Tab from the last link wraps back to the first control (focus trapped)', doc.activeElement === focusables[0]);
  key('Tab', { shiftKey: true });
  check('Shift+Tab from the first control wraps to the last', doc.activeElement === focusables[focusables.length - 1]);
  page.search.focus();
  check('focus that lands behind the pop-up is pulled back in', panel.contains(doc.activeElement));

  key('Escape');
  check('Esc closes it', modal.hidden === true);
  check('and focus returns to the card that opened it', doc.activeElement === card);

  page.cards()[1].click();
  check('a profile with no photo shows initials, and no empty sections or links',
    !modal.hidden && panel.querySelector('.member-initials')?.textContent === 'C' &&
    panel.querySelectorAll('.member-profile-section').length === 1 && !panel.querySelector('.member-profile-links'),
    panel.querySelectorAll('.member-profile-section').length);
  check('opening another profile replaces the content, never stacks it',
    panel.querySelectorAll('.member-profile-name').length === 1 && panel.querySelector('.member-profile-name').textContent === 'Cher');
  modal.querySelector('.member-modal-backdrop').click();
  check('clicking outside the panel closes it', modal.hidden === true);
  page.cards()[0].click();
  close.click();
  check('the close button closes it', modal.hidden === true);
  check('no script errors while using the pop-up', page.errors.length === 0, page.errors);
}

console.log('\nTime Rich Members page — states');
{
  const closed = await open({ reply: { status: 403, body: { error: 'Forbidden' } } });
  check('403 (not launched yet): a calm "opens soon" line, no grid',
    /opens soon/.test(closed.status.textContent) && closed.grid.hidden && closed.cards().length === 0, closed.status.textContent);
  check('403: search stays disabled', closed.search.disabled === true);

  const empty = await open({ reply: { status: 200, body: { profiles: [] } } });
  check('no profiles yet: the empty state from the brief',
    empty.status.textContent === 'Profiles appear here as members complete their questionnaire.' && empty.grid.hidden, empty.status.textContent);

  const broken = await open({ reply: { status: 500, body: {} } });
  check('server error: a refresh message, no grid', /could not load/.test(broken.status.textContent) && broken.grid.hidden);

  const signedOut = await open({ code: null });
  check('no session stored: the Worker is not called', signedOut.requests.filter((r) => r.url === DIRECTORY_URL).length === 0);
}

console.log('\nTime Rich Members page — copy');
{
  const page = await open();
  check('title is "Time Rich Members"', page.doc.querySelector('main h1').textContent.trim() === 'Time Rich Members');
  check('intro line from the brief', page.doc.querySelector('main header p').textContent.trim() === 'Your cohort. Find the right person and make the ask.');
  const ownCopy = readFileSync(new URL('../../portal/members.html', import.meta.url), 'utf8')
    .split('<main')[1].split('</main>')[0] + HTML.split('Time Rich Members: the cohort directory.')[1].split('</script>')[0];
  check('no em dashes or exclamation marks in the page copy', !/—/.test(ownCopy) && !/[A-Za-z]!/.test(ownCopy.replace(/!==|!=|!\w|\(!/g, '')));
  check('Members is marked as the current page in the nav', page.doc.querySelector('nav a[href="members.html"][aria-current="page"]') !== null);
  check('no stray merge text carried over from the shell', !HTML.includes('origin/main'));
}

// ---------------------------------------------------------------------------
// The hidden "Members" link on the other portal pages, driven by the real
// portal/portal-access.js.
// ---------------------------------------------------------------------------
const ACCESS_JS = readFileSync(new URL('../../portal/portal-access.js', import.meta.url), 'utf8');
const PAGES = ['dashboard', 'curriculum', 'sessions', 'resources', 'lesson'];

async function openPortalPage(name, { directoryStatus = 200, cache, directoryThrows = false } = {}) {
  const html = readFileSync(new URL(`../../portal/${name}.html`, import.meta.url), 'utf8');
  const calls = [];
  const dom = new JSDOM(html, {
    url: `https://timerich.ai/portal/${name}.html`,
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
      if (cache) window.sessionStorage.setItem('tr_members_link', JSON.stringify(cache));
      window.fetch = (url, init = {}) => {
        url = String(url);
        calls.push(url);
        if (url.includes('/portal-session') || url.includes('/rpc/portal_get')) {
          return Promise.resolve(new globalThis.Response(JSON.stringify({ ok: true, member: { first_name: 'Ada', role: 'buyer' }, weeks: [], sessions: [] }), { status: 200 }));
        }
        if (url === DIRECTORY_URL) {
          if (directoryThrows) return Promise.reject(new Error('offline'));
          return Promise.resolve(new globalThis.Response(JSON.stringify({ profiles: [] }), { status: directoryStatus }));
        }
        return Promise.resolve(new globalThis.Response('{}', { status: 200 }));
      };
    },
  });
  dom.window.eval(ACCESS_JS);
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
  const links = [...dom.window.document.querySelectorAll('[data-portal-members-link]')];
  return { dom, links, calls, directoryCalls: () => calls.filter((u) => u === DIRECTORY_URL).length };
}

console.log('\nMembers nav link on the other portal pages');
for (const name of PAGES) {
  const html = readFileSync(new URL(`../../portal/${name}.html`, import.meta.url), 'utf8');
  const raw = [...html.matchAll(/<a href="members\.html"([^>]*)>/g)].map((m) => m[1]);
  check(name + '.html: a Members link in the top nav and the phone menu, both hidden by default',
    raw.length === 2 && raw.every((attrs) => /data-portal-members-link/.test(attrs) && /\shidden(\s|$)/.test(attrs)), raw);
}
{
  const css = readFileSync(new URL('../../portal/portal-content.css', import.meta.url), 'utf8');
  check('the shared stylesheet keeps a hidden link hidden even with Tailwind .flex on it',
    /\[data-portal-members-link\]\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(css));

  const closed = await openPortalPage('dashboard', { directoryStatus: 403 });
  check('directory 403 (switched off, a buyer): the link stays hidden',
    closed.links.length === 2 && closed.links.every((a) => a.hidden), closed.links.map((a) => a.hidden));
  check('the session token is sent to the directory with POST', closed.directoryCalls() === 1);
  check('a 403 is remembered for the tab, as "hidden"',
    JSON.parse(closed.dom.window.sessionStorage.getItem('tr_members_link')).ok === false);

  const open200 = await openPortalPage('curriculum', { directoryStatus: 200 });
  check('directory 200 (switched on, or team): the link is shown', open200.links.every((a) => !a.hidden));

  const cached = await openPortalPage('sessions', { cache: { ok: true, at: Date.now() } });
  check('a recent answer is reused: no extra call, link shown', cached.directoryCalls() === 0 && cached.links.every((a) => !a.hidden));

  const stale = await openPortalPage('lesson', { cache: { ok: true, at: Date.now() - 11 * 60 * 1000 }, directoryStatus: 403 });
  check('an answer older than ten minutes is asked again', stale.directoryCalls() === 1 && stale.links.every((a) => a.hidden));

  const down = await openPortalPage('resources', { directoryStatus: 500 });
  check('Worker error: link hidden and nothing remembered, so the next page asks again',
    down.links.every((a) => a.hidden) && down.dom.window.sessionStorage.getItem('tr_members_link') === null);

  const offline = await openPortalPage('dashboard', { directoryThrows: true });
  check('network failure: link hidden', offline.links.every((a) => a.hidden));

  open200.dom.window.TRPortal.signOut();
  check('signing out forgets the remembered answer', open200.dom.window.sessionStorage.getItem('tr_members_link') === null);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
