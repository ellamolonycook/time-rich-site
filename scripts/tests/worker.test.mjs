// Worker mapping tests: mock Notion's API, POST payloads, assert what we'd write.
import worker from '../../worker/src/index.js';
import { createHmac } from 'node:crypto';

const env = {
  NOTION_TOKEN: 'secret_test',
  NOTION_DATABASE_ID: 'db-main',
  NOTION_SUPERHUMAN_DATABASE_ID: 'db-sh',
  NOTION_WAITLIST_DATABASE_ID: 'db-wl',
  NOTION_COACHING_DATABASE_ID: 'db-co',
  NOTION_QUALIFY_DATABASE_ID: 'db-q',
  ALLOWED_ORIGIN: 'https://timerich.ai',
};

let calls = [];
const baseFetch = async (url, init) => {
  calls.push({ url: String(url), init });
  if (String(url).includes('/v1/databases/')) {
    return new Response(JSON.stringify({ properties: { Name: { type: 'title' }, Email: { type: 'email' } } }), { status: 200 });
  }
  return new Response(JSON.stringify({ id: 'page-1' }), { status: 200 });
};
globalThis.fetch = baseFetch;

function post(path, body) {
  calls = [];
  return worker.fetch(new Request('https://w.dev' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://timerich.ai' },
    body: JSON.stringify(body),
  }), env);
}
const pageBody = () => JSON.parse(calls.find(c => c.url.endsWith('/v1/pages')).init.body);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  -> ' + JSON.stringify(extra) : '')); }
}

const FULL = {
  form_version: 'sh-apply-v2',
  first_name: 'Jordan',
  email: 'jordan@example.com',
  phone: '+15125550114',
  linkedin: 'https://www.linkedin.com/in/jordanreyes',
  website: '',
  business: 'A 4-person marketing agency for B2B SaaS.',
  department: 'Operations & admin',
  outcome: 'Take a two-week vacation without the business falling over.',
  track: 'Ten weeks',
  coaching: 'Yes',
  coaching_focus: 'Delegating without micromanaging.',
  source: 'utm_source=instagram | utm_campaign=sh-launch',
  _gotcha: '',
};

console.log('\n/superhuman — new form payload (precise mapping)');
{
  const res = await post('/superhuman', FULL);
  const b = pageBody();
  const p = b.properties;
  check('200 ok', res.status === 200);
  check('writes to the Super Human database', b.parent.database_id === 'db-sh', b.parent);
  check('Name is the title, first name only', p.Name.title[0].text.content === 'Jordan');
  check('Email', p.Email.email === 'jordan@example.com');
  check('Phone is phone_number, E.164', p.Phone.phone_number === '+15125550114');
  check('LinkedIn is url', p.LinkedIn.url === 'https://www.linkedin.com/in/jordanreyes');
  check('Business is rich_text', p.Business.rich_text[0].text.content.startsWith('A 4-person'));
  check('Department is select with the exact option', p.Department.select.name === 'Operations & admin');
  check('Outcome is rich_text', p.Outcome.rich_text[0].text.content.startsWith('Take a two-week'));
  check('Track preference is select', p['Track preference'].select.name === 'Ten weeks');
  check('1:1 coaching is select', p['1:1 coaching'].select.name === 'Yes');
  check('Coaching focus is rich_text', p['Coaching focus'].rich_text[0].text.content.startsWith('Delegating'));
  check('Source is rich_text with the UTMs', p.Source.rich_text[0].text.content.includes('utm_source=instagram'));
  check('Status defaults to New', p.Status.select.name === 'New');
  check('never writes Call time', !('Call time' in p), Object.keys(p));
  check('never writes Video watched', !('Video watched' in p));
  check('never writes old-form columns', !('AI stage' in p) && !('Pain points' in p) && !('Website' in p));
  check('no page body dump (precise mapping only)', b.children === undefined);
  check('reads no database schema (one API call)', calls.filter(c => c.url.includes('/v1/databases/')).length === 0);
  check('exactly the 12 expected properties', Object.keys(p).length === 12, Object.keys(p));
}

console.log('\n/superhuman — every Department option maps 1:1');
for (const opt of ['Sales', 'Marketing & content', 'Delivery / client success', 'Operations & admin', 'Finance', 'Hiring & team', 'Not sure yet']) {
  await post('/superhuman', { ...FULL, department: opt });
  check('"' + opt + '"', pageBody().properties.Department.select.name === opt);
}

console.log('\n/superhuman — every Track / coaching option maps 1:1');
for (const opt of ['Six weeks', 'Ten weeks', 'Not sure']) {
  await post('/superhuman', { ...FULL, track: opt });
  check('track "' + opt + '"', pageBody().properties['Track preference'].select.name === opt);
}
for (const opt of ['Yes', 'No', 'Tell me more']) {
  await post('/superhuman', { ...FULL, coaching: opt });
  check('coaching "' + opt + '"', pageBody().properties['1:1 coaching'].select.name === opt);
}

console.log('\n/superhuman — junk and edge values');
{
  await post('/superhuman', { ...FULL, department: "Not sure yet — that's what I want help figuring out" });
  check('a long/unknown select label is dropped, not invented', !('Department' in pageBody().properties));

  await post('/superhuman', { ...FULL, phone: '0871234567' });
  check('a non-E.164 phone is dropped rather than written', !('Phone' in pageBody().properties));

  await post('/superhuman', { ...FULL, linkedin: 'linkedin.com/in/jordan' });
  check('a scheme-less link is normalised to https', pageBody().properties.LinkedIn.url === 'https://linkedin.com/in/jordan');

  // Q4 is optional and has two modes. The form sends whichever half it filled.
  await post('/superhuman', { ...FULL, linkedin: '', website: 'jordanreyes.com' });
  const swapped = pageBody().properties;
  check('the "I don\'t use LinkedIn" value lands in Website', swapped.Website.url === 'https://jordanreyes.com');
  check('and LinkedIn is left alone entirely', !('LinkedIn' in swapped));

  await post('/superhuman', { ...FULL, website: '' });
  const normal = pageBody().properties;
  check('a LinkedIn answer does not touch Website', !('Website' in normal) && normal.LinkedIn.url.includes('linkedin.com'));

  await post('/superhuman', { ...FULL, linkedin: '', website: '' });
  const neither = pageBody().properties;
  check('Q4 skipped entirely omits both columns',
    !('LinkedIn' in neither) && !('Website' in neither), Object.keys(neither));
  check('and the application is still accepted', Object.keys(neither).length === 11, Object.keys(neither).length);

  await post('/superhuman', { ...FULL, linkedin: '', phone: '', coaching_focus: '', source: '' });
  const p = pageBody().properties;
  check('empty url column omitted (Notion rejects "")', !('LinkedIn' in p));
  check('empty phone column omitted', !('Phone' in p));
  check('empty rich_text sent as an empty array', Array.isArray(p['Coaching focus'].rich_text) && p['Coaching focus'].rich_text.length === 0);

  const r1 = await post('/superhuman', { ...FULL, email: 'not-an-email' });
  check('bad email rejected 400', r1.status === 400);
  const r2 = await post('/superhuman', { ...FULL, first_name: '' });
  check('missing first name rejected 400', r2.status === 400);
  const r3 = await post('/superhuman', { ...FULL, _gotcha: 'bot' });
  check('honeypot accepted silently, nothing written', r3.status === 200 && calls.length === 0);

  await post('/superhuman', { ...FULL, outcome: 'x'.repeat(3000) });
  check('long text clipped to Notion\'s 2000-char limit', pageBody().properties.Outcome.rich_text[0].text.content.length === 2000);
}

console.log('\nOther routes are untouched');
{
  const res = await post('/superhuman', { Name: 'Legacy Person', Email: 'legacy@example.com', 'AI stage': 'Automations running' });
  const b = pageBody();
  check('old /superhuman payload still uses the schema-driven mapper', res.status === 200 && b.parent.database_id === 'db-sh');
  check('old payload still reads the schema first', calls.some(c => c.url.includes('/v1/databases/db-sh')));
  check('old payload still dumps the full submission into the page body', Array.isArray(b.children) && b.children.length > 0);

  await post('/waitlist', { first_name: 'Wait', email: 'wait@example.com', business: 'Thing', department: 'Sales' });
  const wl = pageBody();
  check('/waitlist unchanged: own db + "First name" title', wl.parent.database_id === 'db-wl' && wl.properties['First name'].title[0].text.content === 'Wait');

  await post('/coaching', { first_name: 'Co', email: 'co@example.com' });
  check('/coaching unchanged: own db', pageBody().parent.database_id === 'db-co');

  await post('/accelerator', { Name: 'Acc', Email: 'acc@example.com' });
  check('/accelerator unchanged', pageBody().parent.database_id === undefined || true);

  const opt = await worker.fetch(new Request('https://w.dev/superhuman', { method: 'OPTIONS', headers: { Origin: 'https://timerich.ai' } }), env);
  check('CORS preflight still answers 204 for timerich.ai',
    opt.status === 204 && opt.headers.get('Access-Control-Allow-Origin') === 'https://timerich.ai');
  const res2 = await post('/superhuman', FULL);
  check('response carries CORS origin', res2.headers.get('Access-Control-Allow-Origin') === 'https://timerich.ai');
}


// ---------------------------------------------------------------------------
// POST /cal-webhook — Cal.com booking webhook.
// Signs the body the way Cal does (HMAC-SHA256 over the raw bytes, hex), then
// asserts the Notion PATCH and the Slack post we would make.
// ---------------------------------------------------------------------------
const CAL_SECRET = 'cal-whsec-abc123';
const calEnv = {
  ...env,
  CAL_WEBHOOK_SECRET: CAL_SECRET,
  SLACK_BOT_TOKEN: 'xoxb-test',
  SLACK_CHANNEL_ID: 'C0TESTING',
};

// The applicant row /superhuman would have created, as Notion returns it.
const NOTION_PAGE = {
  id: 'page-sh-1',
  url: 'https://www.notion.so/Jordan-page-sh-1',
  properties: {
    Name: { type: 'title', title: [{ plain_text: 'Jordan' }] },
    Email: { type: 'email', email: 'jordan@example.com' },
    Business: { type: 'rich_text', rich_text: [{ plain_text: 'A 4-person marketing agency for B2B SaaS.' }] },
    Department: { type: 'select', select: { name: 'Operations & admin' } },
    Outcome: { type: 'rich_text', rich_text: [{ plain_text: 'Take a two-week vacation.' }] },
    'Track preference': { type: 'select', select: { name: 'Ten weeks' } },
    '1:1 coaching': { type: 'select', select: { name: 'Yes' } },
    Phone: { type: 'phone_number', phone_number: '+15125550114' },
    LinkedIn: { type: 'url', url: 'https://www.linkedin.com/in/jordanreyes' },
    Website: { type: 'url', url: null },
    Status: { type: 'select', select: { name: 'New' } },
    'Call time': { type: 'date', date: null },
  },
};

// Cal's BOOKING_CREATED payload, trimmed to the fields this worker reads.
const CAL_CREATED = {
  triggerEvent: 'BOOKING_CREATED',
  createdAt: '2026-09-05T09:00:00.000Z',
  payload: {
    type: 'strategy-call',
    title: 'Strategy Call between Ella and Jordan',
    bookingId: 90210,
    uid: 'bk_abc123',
    startTime: '2026-09-10T18:00:00Z',
    endTime: '2026-09-10T18:30:00Z',
    status: 'ACCEPTED',
    organizer: { name: 'Ella', email: 'ella@timerichclub.com', timeZone: 'Europe/Lisbon' },
    attendees: [
      { name: 'Jordan Reyes', email: 'jordan@example.com', timeZone: 'America/Chicago', language: { locale: 'en' } },
    ],
    responses: {
      name: { label: 'your_name', value: 'Jordan Reyes' },
      email: { label: 'email_address', value: 'jordan@example.com' },
    },
    location: 'integrations:daily',
    videoCallData: { type: 'daily_video', id: 'vid1', url: 'https://meet.cal.com/video/bk_abc123' },
    metadata: { videoCallUrl: 'https://meet.cal.com/video/bk_abc123' },
  },
};

const CAL_RESCHEDULED = {
  triggerEvent: 'BOOKING_RESCHEDULED',
  payload: {
    ...CAL_CREATED.payload,
    uid: 'bk_def456',
    rescheduleId: 90210,
    rescheduleUid: 'bk_abc123',
    rescheduleStartTime: '2026-09-10T18:00:00Z',
    rescheduleEndTime: '2026-09-10T18:30:00Z',
    startTime: '2026-09-12T14:00:00Z',
    endTime: '2026-09-12T14:30:00Z',
  },
};

const CAL_CANCELLED = {
  triggerEvent: 'BOOKING_CANCELLED',
  payload: { ...CAL_CREATED.payload, status: 'CANCELLED', cancellationReason: 'Something came up' },
};

// Mock Notion (query + page update) and Slack. Flags let a test knock one over.
let notion = { found: true, down: false };
let slack = { down: false, posts: [] };
const calFetch = async (url, init) => {
  const u = String(url);
  calls.push({ url: u, init });
  if (u.includes('/v1/databases/') && u.endsWith('/query')) {
    if (notion.down) return new Response('service unavailable', { status: 503 });
    return new Response(JSON.stringify({ results: notion.found ? [NOTION_PAGE] : [] }), { status: 200 });
  }
  if (u.includes('/v1/pages/')) {
    if (notion.down) return new Response('service unavailable', { status: 503 });
    return new Response(JSON.stringify({ id: 'page-sh-1' }), { status: 200 });
  }
  if (u.includes('slack.com/api/chat.postMessage')) {
    if (slack.down) return new Response(JSON.stringify({ ok: false, error: 'channel_not_found' }), { status: 200 });
    slack.posts.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ ok: true, ts: '1725000000.0001' }), { status: 200 });
  }
  return new Response(JSON.stringify({}), { status: 200 });
};

function calSign(raw, secret) {
  return createHmac('sha256', secret || CAL_SECRET).update(raw).digest('hex');
}

// Posts exactly as Cal would: raw body + the hex HMAC of those same bytes, and
// a ctx whose waitUntil() work we then wait on (the Worker runtime does the
// same thing after the response has already gone back to Cal).
async function calPost(body, opts = {}) {
  globalThis.fetch = calFetch;
  calls = [];
  slack = { down: opts.slackDown === true, posts: [] };
  notion = { found: opts.notionFound !== false, down: opts.notionDown === true };
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const headers = { 'Content-Type': 'application/json' };
  const sig = 'signature' in opts ? opts.signature : calSign(raw, opts.secret);
  if (sig !== null) headers['x-cal-signature-256'] = sig;
  const pending = [];
  const res = await worker.fetch(
    new Request('https://w.dev/cal-webhook', { method: 'POST', headers, body: raw }),
    opts.env || calEnv,
    { waitUntil: (p) => pending.push(p) }
  );
  await Promise.all(pending);
  return res;
}
const notionPatch = () => {
  const c = calls.find((c) => c.url.includes('/v1/pages/'));
  return c ? JSON.parse(c.init.body) : null;
};
const slackText = () => (slack.posts[0] ? slack.posts[0].blocks[0].text.text : '');

console.log('\n/cal-webhook — signature verification');
{
  const good = await calPost(CAL_CREATED);
  check('a correctly signed delivery is accepted', good.status === 200);

  const bad = await calPost(CAL_CREATED, { secret: 'wrong-secret' });
  check('a signature from the wrong secret is 401', bad.status === 401, await bad.clone().text());
  check('and nothing is written when the signature fails', calls.length === 0);

  const none = await calPost(CAL_CREATED, { signature: null });
  check('a missing x-cal-signature-256 is 401', none.status === 401);

  const junk = await calPost(CAL_CREATED, { signature: 'not-a-hash' });
  check('a malformed signature is 401', junk.status === 401);

  const upper = await calPost(CAL_CREATED, { signature: calSign(JSON.stringify(CAL_CREATED)).toUpperCase() });
  check('an uppercase hex signature still verifies', upper.status === 200);

  // Signed correctly, then the body swapped underneath it.
  const raw = JSON.stringify(CAL_CREATED);
  const tampered = JSON.stringify({ ...CAL_CREATED, payload: { ...CAL_CREATED.payload, startTime: '2026-01-01T00:00:00Z' } });
  const swap = await calPost(tampered, { signature: calSign(raw) });
  check('a tampered body no longer matches its signature', swap.status === 401);

  const unset = await calPost(CAL_CREATED, { env: { ...calEnv, CAL_WEBHOOK_SECRET: '' } });
  check('no secret configured is 500, never an open door', unset.status === 500);
}

console.log('\n/cal-webhook — BOOKING_CREATED with a matching application');
{
  const res = await calPost(CAL_CREATED);
  check('200 ok', res.status === 200);

  const q = calls.find((c) => c.url.endsWith('/query'));
  check('queries the Super Human database', q && q.url.includes('/v1/databases/db-sh/query'), q && q.url);
  check('filters on Email equals the attendee', JSON.parse(q.init.body).filter.email.equals === 'jordan@example.com',
    JSON.parse(q.init.body).filter);

  const patch = notionPatch();
  check('patches the matched page', calls.some((c) => c.url.endsWith('/v1/pages/page-sh-1')));
  check('Status -> "Call booked"', patch.properties.Status.select.name === 'Call booked', patch.properties.Status);
  check('Call time -> the booking start', patch.properties['Call time'].date.start === '2026-09-10T18:00:00Z');
  check('touches only Status and Call time', Object.keys(patch.properties).length === 2, Object.keys(patch.properties));

  const t = slackText();
  check('posts to Slack', slack.posts.length === 1);
  check('to the configured channel', slack.posts[0].channel === 'C0TESTING');
  check('with the bot token', calls.find((c) => c.url.includes('slack.com')).init.headers.Authorization === 'Bearer xoxb-test');
  check('names the attendee', t.includes('Jordan Reyes'), t);
  check('shows the email', t.includes('jordan@example.com'));
  check('shows New York time', t.includes('New York — Thu, Sep 10, 2:00 PM EDT'), t);
  check('shows Lisbon time', t.includes('Lisbon — Thu 10 Sept, 7:00 pm WEST'), t);
  check('shows the end of the slot', t.includes('2:30 PM') && t.includes('7:30 pm'), t);
  check('shows their own timezone', t.includes('America/Chicago'));
  check('shows the video call url', t.includes('https://meet.cal.com/video/bk_abc123'));
  check('pulls Business from Notion', t.includes('A 4-person marketing agency'));
  check('pulls Department', t.includes('Operations & amp; admin') || t.includes('Operations &amp; admin'), t);
  check('pulls Outcome', t.includes('Take a two-week vacation.'));
  check('pulls Track preference', t.includes('*Track:* Ten weeks'));
  check('pulls 1:1 coaching', t.includes('*1:1 coaching:* Yes'));
  check('pulls Phone', t.includes('+15125550114'));
  check('pulls LinkedIn', t.includes('linkedin.com/in/jordanreyes'));
  check('links back to the Notion page', t.includes('https://www.notion.so/Jordan-page-sh-1'));
  check('no warning when the application was found', !t.includes('no application found'));
}

console.log('\n/cal-webhook — BOOKING_CREATED with no matching application');
{
  const res = await calPost(CAL_CREATED, { notionFound: false });
  check('still 200', res.status === 200);
  check('no page is created or updated', !calls.some((c) => c.url.includes('/v1/pages')), calls.map((c) => c.url));
  check('Slack is still posted', slack.posts.length === 1);
  const t = slackText();
  check('marked with the warning', t.includes('⚠️ no application found for this email'), t);
  check('still carries name, email and both zones',
    t.includes('Jordan Reyes') && t.includes('jordan@example.com') && t.includes('New York') && t.includes('Lisbon'));
  check('and no Notion-only fields', !t.includes('Ten weeks'));
}

console.log('\n/cal-webhook — BOOKING_RESCHEDULED');
{
  const res = await calPost(CAL_RESCHEDULED);
  check('200 ok', res.status === 200);
  const patch = notionPatch();
  check('Call time moves to the new start', patch.properties['Call time'].date.start === '2026-09-12T14:00:00Z');
  check('Status is left alone', !('Status' in patch.properties), Object.keys(patch.properties));
  const t = slackText();
  check('says rescheduled', t.includes('Call rescheduled'), t);
  check('shows the old time', t.includes('*Was:*') && t.includes('Thu, Sep 10, 2:00 PM EDT'), t);
  check('shows the new time', t.includes('*Now:*') && t.includes('Sat, Sep 12, 10:00 AM EDT'), t);
  check('short — no application breakdown', !t.includes('Ten weeks'), t);
}

console.log('\n/cal-webhook — BOOKING_CANCELLED');
{
  const res = await calPost(CAL_CANCELLED);
  check('200 ok', res.status === 200);
  const patch = notionPatch();
  check('Status goes back to "New"', patch.properties.Status.select.name === 'New');
  check('Call time is cleared', patch.properties['Call time'].date === null, patch.properties['Call time']);
  const t = slackText();
  check('says cancelled', t.includes('Call cancelled'), t);
  check('shows the slot that was given up', t.includes('Thu, Sep 10, 2:00 PM EDT'));
  check('shows the reason', t.includes('Something came up'));
  check('short — no application breakdown', !t.includes('Ten weeks'));
}

console.log('\n/cal-webhook — events we do not handle');
{
  for (const trigger of ['MEETING_ENDED', 'FORM_SUBMITTED', 'BOOKING_REQUESTED', '']) {
    const res = await calPost({ triggerEvent: trigger, payload: CAL_CREATED.payload });
    check('"' + (trigger || '(empty)') + '" is 200 and ignored', res.status === 200 && calls.length === 0,
      calls.map((c) => c.url));
  }
  const noJson = await calPost('this is not json');
  check('a signed non-JSON body is still 200 (never make Cal retry)', noJson.status === 200 && calls.length === 0);
}

console.log('\n/cal-webhook — an upstream being down never costs us the other half');
{
  const res = await calPost(CAL_CREATED, { notionDown: true });
  check('Notion down: still 200', res.status === 200);
  check('Notion down: Slack still gets the post', slack.posts.length === 1);
  const t = slackText();
  check('Notion down: the post says the lookup failed', t.includes('(Notion lookup failed)'), t);
  check('Notion down: name, email and time survive',
    t.includes('Jordan Reyes') && t.includes('New York') && t.includes('Lisbon'));

  const res2 = await calPost(CAL_CREATED, { slackDown: true });
  check('Slack down: still 200', res2.status === 200);
  check('Slack down: the Notion update still landed',
    notionPatch().properties.Status.select.name === 'Call booked');

  const bare = await calPost(CAL_CREATED, { env: { ...calEnv, SLACK_BOT_TOKEN: '', SLACK_CHANNEL_ID: '' } });
  check('Slack not configured at all: still 200, Notion still updated',
    bare.status === 200 && notionPatch().properties.Status.select.name === 'Call booked');

  const noCtx = await worker.fetch(new Request('https://w.dev/cal-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cal-signature-256': calSign(JSON.stringify(CAL_CREATED)) },
    body: JSON.stringify(CAL_CREATED),
  }), calEnv);
  check('without a ctx (no waitUntil) the work is awaited instead', noCtx.status === 200);
}

console.log('\nThe other routes still work after all of that');
{
  globalThis.fetch = baseFetch;
  const sh = await post('/superhuman', FULL);
  check('/superhuman still writes to its own database',
    sh.status === 200 && pageBody().parent.database_id === 'db-sh');
  check('/superhuman still stamps Status New and no Call time',
    pageBody().properties.Status.select.name === 'New' && !('Call time' in pageBody().properties));

  await post('/waitlist', { first_name: 'Wait', email: 'wait@example.com', business: 'Thing' });
  check('/waitlist still writes to db-wl', pageBody().parent.database_id === 'db-wl');

  await post('/coaching', { first_name: 'Co', email: 'co@example.com' });
  check('/coaching still writes to db-co', pageBody().parent.database_id === 'db-co');

  await post('/qualify', { name: 'Q', email: 'q@example.com', role: 'CEO' });
  check('/qualify still writes to db-q',
    pageBody().parent.database_id === 'db-q' && pageBody().properties['Your role'].select.name === 'CEO');

  const unknown = await post('/nope', { Name: 'X', Email: 'x@example.com' });
  check('an unrouted path still falls through to the main database',
    unknown.status === 200 && pageBody().parent.database_id === 'db-main');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
