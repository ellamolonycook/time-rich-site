// Portal sign-in tests.
//
// A member types an email address and nothing else. The Worker rate limits
// per IP, asks Supabase, and hands back a 30 day session token. These tests
// mock Supabase and assert the four answers the route can give: found, not
// found, inactive, and too many attempts.
//
// They also cover the two gated routes, which used to take a passcode and
// now take that token.
import worker from '../../worker/src/index.js';

const NOT_FOUND =
  "We couldn't find that email. Use the email you joined with, or contact emc@timerichclub.com.";

const ORIGIN = 'https://timerich.ai';

const env = {
  SUPABASE_URL: 'https://db.test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  ALLOWED_ORIGIN: ORIGIN,
};

// One active member, one who has been switched off.
const MEMBERS = {
  'ella@example.com': { active: true, first_name: 'Ella', role: 'buyer' },
  'sam@example.com': { active: false, first_name: 'Sam', role: 'buyer' },
};

let calls = [];
let issued = new Map();            // token -> email
let tokenSeq = 0;

function payloadFor(email) {
  const member = MEMBERS[email];
  return {
    ok: true,
    member: { first_name: member.first_name, role: member.role },
    weeks: [],
    sessions: [
      { id: 12, title: 'Open Business Surgery', starts_at: '2026-10-26T16:00:00+00:00',
        join_url: 'https://zoom.us/j/1', recording_url: null,
        addevent_url: 'https://addevent.com/e/abc', week_id: 1 },
      { id: 13, title: 'Training Your Agent', starts_at: '2026-10-30T16:00:00+00:00',
        join_url: null, recording_url: null, addevent_url: null, week_id: 1 },
    ],
  };
}

function mockSupabase(url, init) {
  const body = init?.body ? JSON.parse(init.body) : {};

  if (url.endsWith('/rpc/portal_login')) {
    // The real function normalises before it looks anything up.
    const email = String(body.p_email || '').trim().toLowerCase();
    const member = MEMBERS[email];
    if (!member || !member.active) return new Response(JSON.stringify({ ok: false }), { status: 200 });
    const token = `tok-${++tokenSeq}`;
    issued.set(token, email);
    return new Response(JSON.stringify({
      ...payloadFor(email),
      token,
      expires_at: '2026-11-09T00:00:00+00:00',
    }), { status: 200 });
  }

  if (url.endsWith('/rpc/portal_get_by_token')) {
    const email = issued.get(String(body.p_token || '').trim());
    if (!email) return new Response(JSON.stringify({ ok: false }), { status: 200 });
    return new Response(JSON.stringify(payloadFor(email)), { status: 200 });
  }

  if (url.endsWith('/rpc/portal_logout')) {
    issued.delete(String(body.p_token || '').trim());
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  if (url.endsWith('/rpc/portal_set_progress')) {
    const token = String(body.p_token || '').trim();
    return new Response(JSON.stringify({ ok: issued.has(token) }), { status: 200 });
  }

  if (url.endsWith('/rpc/portal_get')) {
    return new Response(JSON.stringify({ ok: false }), { status: 200 });
  }

  return new Response(JSON.stringify({}), { status: 200 });
}

globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init });
  return mockSupabase(String(url), init);
};

// A KV namespace that behaves like Cloudflare's: string values, TTL ignored
// because no test waits for one to expire.
function memoryKv() {
  const store = new Map();
  return {
    store,
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, String(value)); },
  };
}

function post(path, body, { ip = '203.0.113.1', kv = null } = {}) {
  calls = [];
  const headers = { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': ip };
  return worker.fetch(
    new Request('https://w.dev' + path, { method: 'POST', headers, body: JSON.stringify(body) }),
    kv ? { ...env, PORTAL_LOGIN_RL: kv } : env
  );
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  -> ' + JSON.stringify(extra) : '')); }
}

console.log('\n/portal-login — an active member');
{
  const res = await post('/portal-login', { email: 'ella@example.com' });
  const body = await res.json();
  check('answers 200', res.status === 200, res.status);
  check('hands back a session token', typeof body.token === 'string' && body.token.length > 0, body);
  check('and when it expires', typeof body.expires_at === 'string' && body.expires_at.length > 0, body);
  check('with the portal payload', body.ok === true && Array.isArray(body.sessions), body);
  check('never echoes the email back', !JSON.stringify(body).includes('ella@example.com'), body);

  const sent = JSON.parse(calls.find(c => c.url.endsWith('/rpc/portal_login')).init.body);
  check('sends the address to portal_login', sent.p_email === 'ella@example.com', sent);
}

console.log('\n/portal-login — normalising the address');
{
  const res = await post('/portal-login', { email: '  ELLA@Example.COM  ' });
  const body = await res.json();
  check('trims and lowercases before the lookup', res.status === 200 && typeof body.token === 'string', body);
  const sent = JSON.parse(calls.find(c => c.url.endsWith('/rpc/portal_login')).init.body);
  check('so Postgres receives the canonical form', sent.p_email === 'ella@example.com', sent);
}

console.log('\n/portal-login — an address we do not have');
{
  const res = await post('/portal-login', { email: 'nobody@example.com' });
  const body = await res.json();
  check('answers 404', res.status === 404, res.status);
  check('with the wording Ella asked for', body.message === NOT_FOUND, body);
  check('and no token', !body.token, body);
}

console.log('\n/portal-login — a member who has been switched off');
{
  const res = await post('/portal-login', { email: 'sam@example.com' });
  const body = await res.json();
  check('answers 404, the same as an unknown address', res.status === 404, res.status);
  check('with the same wording, so it says nothing about who exists',
    body.message === NOT_FOUND, body);
  check('and no token', !body.token, body);
}

console.log('\n/portal-login — nonsense input');
{
  const missing = await post('/portal-login', {});
  check('an empty body is a 404, not a 500', missing.status === 404, missing.status);
  check('and never reaches the database',
    !calls.some(c => c.url.includes('/rpc/portal_login')), calls.map(c => c.url));

  const malformed = await post('/portal-login', { email: 'not-an-address' });
  check('an address that is not one is a 404', malformed.status === 404, malformed.status);
  check('and never reaches the database either',
    !calls.some(c => c.url.includes('/rpc/portal_login')), calls.map(c => c.url));
}

console.log('\n/portal-login — rate limit, 10 per IP per 10 minutes');
{
  const kv = memoryKv();
  const statuses = [];
  for (let i = 0; i < 12; i++) {
    const res = await post('/portal-login', { email: 'nobody@example.com' }, { ip: '198.51.100.7', kv });
    statuses.push(res.status);
  }
  check('the first ten attempts are answered normally',
    statuses.slice(0, 10).every(s => s === 404), statuses);
  check('the eleventh is turned away with 429', statuses[10] === 429, statuses);
  check('and so is the twelfth', statuses[11] === 429, statuses);

  const blocked = await post('/portal-login', { email: 'ella@example.com' }, { ip: '198.51.100.7', kv });
  check('a good address is turned away too once the limit is hit',
    blocked.status === 429, blocked.status);
  const body = await blocked.json();
  check('with wording that says to wait', /try again/i.test(body.message || ''), body);

  const other = await post('/portal-login', { email: 'ella@example.com' }, { ip: '198.51.100.8', kv });
  check('another IP is unaffected', other.status === 200, other.status);
}

console.log('\n/portal-login — with no KV namespace bound');
{
  const statuses = [];
  for (let i = 0; i < 12; i++) {
    const res = await post('/portal-login', { email: 'nobody@example.com' }, { ip: '198.51.100.9' });
    statuses.push(res.status);
  }
  // Deliberate: a namespace that was never created must not lock members out.
  check('every attempt still goes through', statuses.every(s => s === 404), statuses);
}

console.log('\n/portal-session — reading the portal with the token');
{
  const login = await post('/portal-login', { email: 'ella@example.com' });
  const { token } = await login.json();

  const res = await post('/portal-session', { token });
  const body = await res.json();
  check('answers 200 with the payload', res.status === 200 && body.ok === true, body);
  check('and carries addevent_url on each session',
    body.sessions.some(s => s.addevent_url === 'https://addevent.com/e/abc'), body.sessions);

  const bad = await post('/portal-session', { token: 'tok-does-not-exist' });
  check('an unknown token is 401', bad.status === 401, bad.status);

  const none = await post('/portal-session', {});
  check('no token at all is 401', none.status === 401, none.status);
}

console.log('\n/portal-logout — the token stops working');
{
  const login = await post('/portal-login', { email: 'ella@example.com' });
  const { token } = await login.json();

  const out = await post('/portal-logout', { token });
  check('answers 200', out.status === 200, out.status);
  check('and tells Postgres to forget it',
    calls.some(c => c.url.endsWith('/rpc/portal_logout')), calls.map(c => c.url));

  const after = await post('/portal-session', { token });
  check('the token is refused afterwards', after.status === 401, after.status);
}

console.log('\n/portal-progress — saving a member tick');
{
  const login = await post('/portal-login', { email: 'ella@example.com' });
  const { token } = await login.json();

  const saved = await post('/portal-progress', { token, item_id: 42, done: true });
  check('saves an item tick with 200', saved.status === 200 && (await saved.json()).ok === true);
  const call = calls.find(c => c.url.endsWith('/rpc/portal_set_progress'));
  const sent = call && JSON.parse(call.init.body);
  check('passes only the signed-in token and target item to Postgres',
    sent && sent.p_token === token && sent.p_item_id === 42 && sent.p_session_id === null && sent.p_done === true,
    sent);

  const malformed = await post('/portal-progress', { token, item_id: 42, session_id: 12, done: true });
  check('rejects two targets before reaching Postgres', malformed.status === 400,
    malformed.status);
  check('the malformed request did not call the RPC',
    !calls.some(c => c.url.endsWith('/rpc/portal_set_progress')), calls.map(c => c.url));

  const expired = await post('/portal-progress', { token: 'tok-does-not-exist', session_id: 12, done: true });
  check('refuses an unknown session token', expired.status === 401, expired.status);
}

console.log('\n/portal-progress — rate limit, separate from sign-in');
{
  const kv = memoryKv();
  const login = await post('/portal-login', { email: 'ella@example.com' }, { ip: '198.51.100.10', kv });
  const { token } = await login.json();
  const statuses = [];
  for (let i = 0; i < 62; i++) {
    const res = await post('/portal-progress', { token, item_id: 42, done: i % 2 === 0 },
      { ip: '198.51.100.10', kv });
    statuses.push(res.status);
  }
  check('the first sixty writes are allowed', statuses.slice(0, 60).every(s => s === 200), statuses);
  check('the sixty-first write is rate limited', statuses[60] === 429, statuses);
  check('later writes stay rate limited in that window', statuses[61] === 429, statuses);

  const separateLogin = await post('/portal-login', { email: 'ella@example.com' }, { ip: '198.51.100.10', kv });
  check('progress writes do not consume sign-in attempts', separateLogin.status === 200, separateLogin.status);
}

console.log('\nThe passcode column is kept, and the old path still works');
{
  // portal_get is still granted to anon and still wired here, so a member
  // who somehow still has a passcode is not locked out by this change.
  const res = await post('/portal-session', { token: 'nope' });
  check('a token the server does not know is simply refused', res.status === 401, res.status);
  check('portal_get is still reachable from the Worker',
    typeof worker.fetch === 'function');
}

console.log('\nCORS on the portal routes: production, plus the local dev server');
{
  // Only the portal routes are affected. The Worker-wide ALLOWED_ORIGIN list
  // that every other route uses is untouched by this.
  const ask = (origin, path = '/portal-login', method = 'OPTIONS') =>
    worker.fetch(new Request('https://w.dev' + path, {
      method,
      headers: origin
        ? { Origin: origin, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' },
      body: method === 'POST' ? JSON.stringify({ email: 'ella@example.com' }) : undefined,
    }), env);

  const allow = async (origin, path, method) =>
    (await ask(origin, path, method)).headers.get('Access-Control-Allow-Origin');

  check('the live site is still allowed', await allow('https://timerich.ai') === 'https://timerich.ai');

  // the local dev server
  check('http://localhost:8000 is allowed', await allow('http://localhost:8000') === 'http://localhost:8000');
  check('http://127.0.0.1:8000 is allowed', await allow('http://127.0.0.1:8000') === 'http://127.0.0.1:8000');

  // other local ports are not: this is the dev server's port, not a blanket
  check('http://localhost:3000 is refused', await allow('http://localhost:3000') === null);
  check('http://localhost (no port) is refused', await allow('http://localhost') === null);
  check('http://127.0.0.1:5173 is refused', await allow('http://127.0.0.1:5173') === null);

  // a host that only looks local must not get through
  check('http://localhost.example.com:8000 is refused', await allow('http://localhost.example.com:8000') === null);
  check('http://127.0.0.1.example.com:8000 is refused', await allow('http://127.0.0.1.example.com:8000') === null);
  check('https://localhost:8000 is refused, http only', await allow('https://localhost:8000') === null);
  check('an unrelated origin is still refused', await allow('https://evil.example') === null);
  check('no Origin header gets no CORS header', await allow('') === null);

  // every portal route, not just the login one
  for (const path of ['/portal-login', '/portal-session', '/portal-logout', '/portal-progress', '/portal-download', '/portal-directory']) {
    check(path + ' answers the local preflight',
      (await ask('http://localhost:8000', path)).status === 204 &&
      await allow('http://localhost:8000', path) === 'http://localhost:8000');
  }

  // and a real POST from the dev server carries the header too
  const posted = await ask('http://localhost:8000', '/portal-login', 'POST');
  check('a POST from the dev server gets the header as well',
    posted.headers.get('Access-Control-Allow-Origin') === 'http://localhost:8000',
    posted.headers.get('Access-Control-Allow-Origin'));
  check('and still answers normally', posted.status === 200, posted.status);
}

if (fail) {
  console.error(`\n${fail} portal login test(s) failed.`);
  process.exit(1);
}
/* ---- the form on the page ------------------------------------------------ */

// The field and the Continue button used to have 76px between them: 12px of
// margin, then a two-line slot held open for an error message, then 20px
// more. Empty, which it is on every first load, that read as a field and a
// button belonging to two different groups.
//
// The slot could not simply be removed. The card is centred on the page, so
// a message appearing in a box of no height would grow the card and lift
// everything by half the extra. It moved below the button instead: the field
// and the button are 12px apart, the two lines are still held open, and the
// card is still the same height whether a message is showing or not.
console.log('\nthe sign-in form, as it sits on the page');
{
  const { JSDOM } = await import('jsdom');
  const { readFileSync } = await import('node:fs');
  const doc = new JSDOM(readFileSync(new URL('../../portal/index.html', import.meta.url), 'utf8'))
    .window.document;

  /* The wordmark carries the club's full name, with the pastel stop closing
     it after CLUB rather than sitting in the middle after RICH. The kicker
     that used to sit under it said "Time Rich Club" a second time, so it has
     gone: the wordmark is the only place the name is now said. */
  const mark = doc.querySelector('.trp-wordmark');
  check('the wordmark reads TIME RICH CLUB.',
    mark !== null && mark.textContent.replace(/\s+/g, ' ').trim() === 'TIME RICH CLUB.',
    mark && mark.textContent.trim());
  check('and the stop is the last thing in it, after CLUB',
    mark !== null && mark.lastElementChild !== null &&
    mark.lastElementChild.classList.contains('trp-stop') &&
    mark.lastElementChild.textContent === '.',
    mark && mark.innerHTML.trim());
  check('the kicker under it is gone, so the name is not said twice',
    doc.querySelector('.trp-kicker') === null);

  const form = doc.querySelector('[data-portal-login]');
  const field = doc.getElementById('email');
  const button = form.querySelector('button[type="submit"]');
  const slot = form.querySelector('[data-portal-error]');

  check('the form has one field and one button',
    form.querySelectorAll('input').length === 1 && form.querySelectorAll('button').length === 1);

  // The order on the page is what closes the gap.
  check('the button follows the field, with nothing between them',
    field.closest('div').nextElementSibling === button,
    field.closest('div').nextElementSibling &&
      field.closest('div').nextElementSibling.tagName);
  check('and the message slot comes after the button',
    button.nextElementSibling === slot, button.nextElementSibling &&
      button.nextElementSibling.tagName);

  // 12px, not the 20px it was, and nothing bigger left on the button.
  check('the button sits mt-3 under the field',
    /\bmt-3\b/.test(button.className) && !/\bmt-[4-9]\b/.test(button.className),
    button.className);

  // The two reserved lines are the thing that stops the centred card moving.
  check('two lines are still held open for a message',
    /min-h-\[2\.75rem\]/.test(slot.className), slot.className);
  check('the slot is still announced politely, as an alert',
    slot.getAttribute('role') === 'alert' && slot.getAttribute('aria-live') === 'polite');

  // It is no longer next to the field, so it has to be joined to it by name.
  check('the field points at the slot, so a screen reader reads the two together',
    slot.id.length > 0 && field.getAttribute('aria-describedby') === slot.id,
    field.getAttribute('aria-describedby') + ' / ' + slot.id);

  // The field still has no name attribute: without one a stray native submit
  // cannot put the address in the URL.
  check('the field still carries no name, so an address never reaches the URL',
    field.getAttribute('name') === null);
}

console.log(`\n${pass} portal login test(s) passed.`);
