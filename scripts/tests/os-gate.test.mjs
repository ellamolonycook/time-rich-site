// The /os email gate, run for real in jsdom: the page's own inline script
// raises it, so these drive the markup the way a visitor would.
//
// The rules it exists to pin, in order of how much they would cost us:
//   1. A visitor is never stuck behind it. A refused POST, a thrown POST and a
//      POST that never comes back all unlock the page anyway.
//   2. The page's markup is never removed, only covered, so links and crawlers
//      are unaffected.
//   3. Without JavaScript there is no gate at all.
//   4. A returning visitor skips it, and blocked storage does not break it.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('../../os/index.html', import.meta.url), 'utf8');
const ENDPOINT = 'https://time-rich-forms.timerich.workers.dev/os-email';
const STORE_KEY = 'tr_os_access';
// The rows the page is actually for: they must survive the gate untouched.
const ROW_IDS = ['compass', 'stanley', 'skills', 'prompts', 'content-os', 'stack', 'live'];

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

/**
 * A fresh page with its inline script run.
 *   access   - a value to seed localStorage with (a returning visitor)
 *   network  - 'ok' | 'error' | 'throw' | 'hang'
 *   storage  - 'blocked' makes every localStorage touch throw
 * The harness also traps the gate's 5s unlock timer so a test can fire it
 * without the suite waiting five seconds for it.
 */
function load(opts = {}) {
  const net = { calls: [], mode: opts.network || 'ok' };
  const logs = [];
  const events = [];
  const slowTimers = [];

  const dom = new JSDOM(HTML, {
    url: 'https://timerich.ai/os',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      // jsdom has no layout, so this is missing on the elements the page's
      // own anchor handler calls it on.
      window.HTMLElement.prototype.scrollIntoView = function () {};

      if (opts.access !== undefined) window.localStorage.setItem(STORE_KEY, opts.access);
      if (opts.storage === 'blocked') {
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          get() { throw new Error('storage is blocked'); },
        });
      }

      window.console.error = (...args) => logs.push(args.map(String).join(' '));
      window.gtag = (...args) => events.push(args);

      // jsdom ships no fetch, so this is the whole network.
      window.fetch = (url, init) => {
        net.calls.push({
          url: String(url),
          init,
          body: init && init.body ? JSON.parse(init.body) : null,
        });
        if (net.mode === 'hang') return new Promise(() => {});
        if (net.mode === 'throw') return Promise.reject(new Error('Failed to fetch'));
        const status = net.mode === 'error' ? 502 : 200;
        return Promise.resolve({ ok: status === 200, status, json: () => Promise.resolve({}) });
      };

      // The gate's "unlock anyway" timer, held so a test can fire it.
      const realSetTimeout = window.setTimeout;
      window.setTimeout = function (fn, ms, ...rest) {
        if (ms === 5000) { slowTimers.push(fn); return 0; }
        return realSetTimeout.call(this, fn, ms, ...rest);
      };
    },
  });

  const { document } = dom.window;
  const page = {
    dom,
    document,
    net,
    logs,
    events,
    /** Fires the 5s unlock timer the gate armed on submit. */
    fireUnlockTimer: () => { slowTimers.forEach((fn) => fn()); },
    gate: () => document.getElementById('osGate'),
    stored: () => { try { return dom.window.localStorage.getItem(STORE_KEY); } catch (e) { return 'THREW'; } },
    locked: () => document.documentElement.classList.contains('gate-locked'),
    submit: () => {
      document.getElementById('gateForm')
        .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
      return settle();
    },
    fill: (email, firstName) => {
      document.getElementById('gateEmail').value = email;
      if (firstName !== undefined) document.getElementById('gateName').value = firstName;
    },
  };
  return page;
}

/** Lets the gate's promise chain run to completion. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

/** The gate defers inert to DOMContentLoaded, because it runs above that markup. */
function ready(page) {
  if (page.document.readyState !== 'loading') return Promise.resolve();
  return new Promise((resolve) => page.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
}

const behind = (page) => [
  page.document.querySelector('.skip'),
  page.document.querySelector('.nav'),
  page.document.getElementById('main'),
  page.document.querySelector('footer'),
];

console.log('\n/os gate — a first visit');
{
  const page = load();
  await ready(page);
  const gate = page.gate();

  check('the overlay is showing', gate && gate.hidden === false);
  check('it is the first thing in the body, so it is up before the page paints',
    page.document.body.firstElementChild.id === 'osGate',
    page.document.body.firstElementChild.tagName + '#' + page.document.body.firstElementChild.id);
  check('it is a modal dialogue to a screen reader',
    gate.getAttribute('role') === 'dialog' &&
    gate.getAttribute('aria-modal') === 'true' &&
    gate.getAttribute('aria-labelledby') === 'gate-h');
  check('focus moves into it', page.document.activeElement === gate,
    page.document.activeElement && page.document.activeElement.id);

  check('the wordmark is there', /TIME RICH/.test(gate.querySelector('.gate-mark').textContent));
  check('the heading is the brief\'s',
    page.document.getElementById('gate-h').textContent.trim() === 'Get the Time Rich AI OS',
    page.document.getElementById('gate-h').textContent.trim());
  check('the one line under it is the brief\'s',
    page.document.getElementById('gate-sub').textContent.trim() === 'Enter your email and it’s yours, free.',
    page.document.getElementById('gate-sub').textContent.trim());
  check('the button says Get access',
    page.document.getElementById('gateSubmit').textContent.trim() === 'Get access');
  check('the small print under the button is the brief\'s',
    gate.querySelector('.gate-note').textContent.trim() ===
      'We’ll send you useful AI stuff. Unsubscribe anytime.',
    gate.querySelector('.gate-note').textContent.trim());

  const name = page.document.getElementById('gateName');
  const email = page.document.getElementById('gateEmail');
  check('first name is optional', !name.hasAttribute('required'));
  check('email is required and typed for the mobile keyboard',
    email.hasAttribute('required') && email.type === 'email' && email.getAttribute('inputmode') === 'email');
  check('both fields autocomplete',
    name.getAttribute('autocomplete') === 'given-name' && email.getAttribute('autocomplete') === 'email');
  check('the form does not lean on the browser\'s own validation bubble',
    page.document.getElementById('gateForm').hasAttribute('novalidate'));
  check('there is a honeypot, off-screen and out of the tab order',
    gate.querySelector('input[name="_gotcha"]').getAttribute('tabindex') === '-1');
  check('the honeypot does not borrow .skip, which would shadow the skip link',
    page.document.querySelector('.skip').tagName === 'A',
    page.document.querySelector('.skip').tagName);

  check('page scroll is locked', page.locked());
  check('the page behind is inert: out of reach of the keyboard and a reader',
    behind(page).every((node) => node && node.inert === true),
    behind(page).map((node) => (node ? node.tagName + ':' + node.inert : 'MISSING')));
  check('nothing is stored yet', page.stored() === null, page.stored());
  check('no request is made just by arriving', page.net.calls.length === 0);
}

console.log('\n/os gate — the page underneath is covered, never removed');
{
  const page = load();
  await ready(page);
  check('every row is still in the document',
    ROW_IDS.every((id) => page.document.getElementById(id)),
    ROW_IDS.filter((id) => !page.document.getElementById(id)));
  check('the main content and the footer are still there',
    !!page.document.getElementById('main') && !!page.document.querySelector('footer'));
  check('the canonical link and the OG tags are untouched',
    page.document.querySelector('link[rel="canonical"]').href === 'https://timerich.ai/os' &&
    !!page.document.querySelector('meta[property="og:title"]'));
  check('the existing tracking is still loaded in the head',
    !!page.document.querySelector('script[src="/js/pixel.js"]') &&
    !!page.document.querySelector('script[src="/js/affiliate.js"]'));
}

console.log('\n/os gate — without JavaScript there is no gate');
{
  const dom = new JSDOM(HTML, { url: 'https://timerich.ai/os' }); // scripts off
  const gate = dom.window.document.getElementById('osGate');
  check('the overlay is hidden in the markup itself', gate.hasAttribute('hidden'));
  check('...and nothing has locked the page', !dom.window.document.documentElement.classList.contains('gate-locked'));
  check('the content is all there to be read and crawled',
    ROW_IDS.every((id) => dom.window.document.getElementById(id)));
}

console.log('\n/os gate — a bad email is refused, and nothing is sent');
{
  const page = load();
  await ready(page);
  const error = page.document.getElementById('gateError');
  const button = page.document.getElementById('gateSubmit');

  page.fill('nina');
  await page.submit();

  check('no request went out', page.net.calls.length === 0);
  check('the overlay is still up', page.gate().hidden === false && page.locked());
  check('an error is shown', error.hidden === false && error.textContent.length > 0, error.textContent);
  check('the error is announced', error.getAttribute('role') === 'alert');
  check('the field is marked invalid, for the eye and for a reader',
    page.document.getElementById('gateEmail').classList.contains('invalid') &&
    page.document.getElementById('gateEmail').getAttribute('aria-invalid') === 'true');
  check('the button is still usable, so a correction can be submitted', button.disabled === false);
  check('nothing was stored', page.stored() === null);

  // Typing again clears it.
  page.fill('nina@example.com');
  page.document.getElementById('gateEmail')
    .dispatchEvent(new page.dom.window.Event('input', { bubbles: true }));
  check('typing clears the error', error.hidden === true &&
    !page.document.getElementById('gateEmail').classList.contains('invalid'));

  await page.submit();
  check('the corrected address goes through', page.net.calls.length === 1);
}

console.log('\n/os gate — the page and the worker agree on what a valid email is');
{
  const bad = ['', ' ', 'nina', 'nina@', '@example.com', 'nina@example', 'ni na@example.com', 'nina@exa mple.com'];
  let refused = 0;
  for (const value of bad) {
    const page = load();
    await ready(page);
    page.fill(value);
    await page.submit();
    if (page.net.calls.length === 0 && page.gate().hidden === false) refused++;
  }
  check('every malformed address the worker would reject is refused here first',
    refused === bad.length, refused + '/' + bad.length);

  const good = ['nina@example.com', 'nina.cook+os@sub.example.co.uk'];
  let sent = 0;
  for (const value of good) {
    const page = load();
    await ready(page);
    page.fill(value);
    await page.submit();
    if (page.net.calls.length === 1) sent++;
  }
  check('real addresses go through', sent === good.length, sent + '/' + good.length);
}

console.log('\n/os gate — a good email unlocks the page');
{
  const page = load();
  await ready(page);
  const button = page.document.getElementById('gateSubmit');
  page.fill('  Nina@Example.com  ', '  Nina  ');

  // The button's own state, caught before the request comes back.
  page.document.getElementById('gateForm')
    .dispatchEvent(new page.dom.window.Event('submit', { bubbles: true, cancelable: true }));
  check('the button is disabled while it is working', button.disabled === true);
  check('...and says One sec', button.textContent.trim() === 'One sec…', button.textContent);
  await settle();

  check('one POST, to the worker route', page.net.calls.length === 1 &&
    page.net.calls[0].url === ENDPOINT, page.net.calls.map((c) => c.url));
  check('it is a POST of JSON', page.net.calls[0].init.method === 'POST' &&
    page.net.calls[0].init.headers['Content-Type'] === 'application/json');
  check('the body is { email, first_name, source: "os" }, trimmed',
    JSON.stringify(page.net.calls[0].body) ===
      JSON.stringify({ email: 'Nina@Example.com', first_name: 'Nina', source: 'os' }),
    page.net.calls[0].body);

  check('the overlay is gone from the document', page.gate() === null);
  check('scroll is unlocked', !page.locked());
  check('the page behind is reachable again',
    behind(page).every((node) => node && node.inert === false),
    behind(page).map((node) => (node ? node.tagName + ':' + node.inert : 'MISSING')));
  check('the content is all still there', ROW_IDS.every((id) => page.document.getElementById(id)));
  check('a confirmed capture is remembered', page.stored() === '1', page.stored());
  check('one os_email_submit event is tracked, the way the site tracks the rest',
    page.events.filter((e) => e[0] === 'event' && e[1] === 'os_email_submit').length === 1,
    page.events);
  check('nothing was logged as a failure', page.logs.length === 0, page.logs);
}

console.log('\n/os gate — a returning visitor never sees it');
{
  const page = load({ access: '1' });
  await ready(page);
  check('the overlay stays hidden', page.gate().hidden === true);
  check('scroll is never locked', !page.locked());
  check('nothing behind is made inert',
    behind(page).every((node) => node && !node.inert),
    behind(page).map((node) => (node ? node.tagName + ':' + node.inert : 'MISSING')));
  check('no request is made', page.net.calls.length === 0);
}
{
  const page = load({ access: 'unverified' });
  await ready(page);
  check('...including one we unlocked without confirming the capture',
    page.gate().hidden === true && !page.locked());
}

console.log('\n/os gate — a worker failure still unlocks the page');
for (const [label, mode] of [['the worker answers 502', 'error'], ['the request throws', 'throw']]) {
  const page = load({ network: mode });
  await ready(page);
  page.fill('nina@example.com', 'Nina');
  await page.submit();

  check(label + ': the overlay is removed anyway', page.gate() === null);
  check(label + ': scroll is unlocked', !page.locked());
  check(label + ': the page behind is reachable',
    behind(page).every((node) => node && node.inert === false));
  check(label + ': the failure is logged to the console',
    page.logs.some((line) => /unlocking anyway/.test(line)), page.logs);
  check(label + ': the unlock is remembered, so there is no second wall',
    page.stored() === 'unverified', page.stored());
}

console.log('\n/os gate — a request that never comes back unlocks after 5s');
{
  const page = load({ network: 'hang' });
  await ready(page);
  page.fill('nina@example.com');
  await page.submit();

  check('the overlay is still up while the request is in flight', page.gate() !== null);
  page.fireUnlockTimer();
  await settle();
  check('the 5s timer removes it', page.gate() === null);
  check('scroll is unlocked', !page.locked());
  check('the timeout is logged', page.logs.some((line) => /more than 5s/.test(line)), page.logs);
  check('and remembered as unconfirmed', page.stored() === 'unverified', page.stored());
}

console.log('\n/os gate — blocked storage breaks nothing');
{
  const page = load({ storage: 'blocked' });
  await ready(page);
  check('the gate still shows', page.gate().hidden === false && page.locked());

  page.fill('nina@example.com');
  await page.submit();
  check('the email still goes out', page.net.calls.length === 1);
  check('the page still unlocks', page.gate() === null && !page.locked());
}

console.log('\n/os gate — the page\'s own behaviour is untouched');
{
  // The gate is gone by the time a reader gets here, so the rows must work
  // exactly as os-page.test.mjs pins them.
  const page = load();
  await ready(page);
  page.fill('nina@example.com');
  await page.submit();

  const row = page.document.getElementById('stanley');
  row.querySelector('.row-btn').dispatchEvent(new page.dom.window.MouseEvent('click', { bubbles: true }));
  check('a row still opens on a click',
    row.classList.contains('is-open') && row.querySelector('.row-panel').hidden === false);

  const toggle = page.document.getElementById('navToggle');
  toggle.dispatchEvent(new page.dom.window.MouseEvent('click', { bubbles: true }));
  check('the mobile menu still opens',
    page.document.getElementById('navlinks').classList.contains('open'));
  check('...and it inerts the nav wordmark, not the gate\'s mark',
    page.document.querySelector('.wordmark').inert === true &&
    page.document.querySelector('.wordmark').closest('.nav') !== null);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
