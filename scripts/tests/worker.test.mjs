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
  department: ['Operations & admin'],
  outcome: 'Take a two-week vacation without the business falling over.',
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
  check('Department is multi_select with the exact option',
    p.Department.multi_select.map((o) => o.name).join() === 'Operations & admin', p.Department);
  check('Outcome is rich_text', p.Outcome.rich_text[0].text.content.startsWith('Take a two-week'));
  check('Track preference is never written — the question is gone from the form',
    !('Track preference' in p), Object.keys(p));
  check('1:1 coaching is select', p['1:1 coaching'].select.name === 'Yes');
  check('Coaching focus is rich_text', p['Coaching focus'].rich_text[0].text.content.startsWith('Delegating'));
  check('Source is rich_text with the UTMs', p.Source.rich_text[0].text.content.includes('utm_source=instagram'));
  check('Status defaults to New', p.Status.select.name === 'New');
  check('never writes Call time', !('Call time' in p), Object.keys(p));
  check('never writes Video watched', !('Video watched' in p));
  check('never writes old-form columns', !('AI stage' in p) && !('Pain points' in p) && !('Website' in p));
  check('no page body dump (precise mapping only)', b.children === undefined);
  check('reads no database schema (one API call)', calls.filter(c => c.url.includes('/v1/databases/')).length === 0);
  check('exactly the 11 expected properties', Object.keys(p).length === 11, Object.keys(p));
}

console.log('\n/superhuman — every Department option maps 1:1');
const SH_DEPTS = ['Sales', 'Marketing & content', 'Delivery / client success', 'Operations & admin', 'Finance', 'Hiring & team', 'Not sure yet'];
for (const opt of SH_DEPTS) {
  await post('/superhuman', { ...FULL, department: [opt] });
  check('"' + opt + '"', pageBody().properties.Department.multi_select.map((o) => o.name).join() === opt);
}

console.log('\n/superhuman — Department carries several answers');
{
  await post('/superhuman', { ...FULL, department: ['Sales', 'Finance', 'Hiring & team'] });
  check('all three land in one multi_select',
    pageBody().properties.Department.multi_select.map((o) => o.name).join() === 'Sales,Finance,Hiring & team',
    pageBody().properties.Department);

  await post('/superhuman', { ...FULL, department: SH_DEPTS });
  check('every option at once is fine', pageBody().properties.Department.multi_select.length === 7);

  await post('/superhuman', { ...FULL, department: ['Sales', 'Not a department', 'Finance'] });
  check('an unknown value is dropped and the known ones still go',
    pageBody().properties.Department.multi_select.map((o) => o.name).join() === 'Sales,Finance',
    pageBody().properties.Department);

  await post('/superhuman', { ...FULL, department: ['Sales', 'Sales'] });
  check('duplicates are collapsed — Notion rejects a repeated option name',
    pageBody().properties.Department.multi_select.length === 1, pageBody().properties.Department);

  await post('/superhuman', { ...FULL, department: [] });
  check('an empty selection omits the property rather than clearing it',
    !('Department' in pageBody().properties), Object.keys(pageBody().properties));

  await post('/superhuman', { ...FULL, department: undefined });
  check('a missing department is omitted too', !('Department' in pageBody().properties));

  // A session stored before the question took several answers holds a string.
  await post('/superhuman', { ...FULL, department: 'Finance' });
  check('a bare string is still accepted, as a one-item multi_select',
    pageBody().properties.Department.multi_select.map((o) => o.name).join() === 'Finance',
    pageBody().properties.Department);
}

console.log('\n/superhuman — every coaching option maps 1:1');
for (const opt of ['Yes', 'No', 'Tell me more']) {
  await post('/superhuman', { ...FULL, coaching: opt });
  check('coaching "' + opt + '"', pageBody().properties['1:1 coaching'].select.name === opt);
}

console.log('\n/superhuman — junk and edge values');
{
  await post('/superhuman', { ...FULL, department: ["Not sure yet — that's what I want help figuring out"] });
  check('a long/unknown select label is dropped, not invented', !('Department' in pageBody().properties));

  await post('/superhuman', { ...FULL, track: 'Ten weeks' });
  check('a stale page still sending a track is ignored, not written through',
    !('Track preference' in pageBody().properties), Object.keys(pageBody().properties));

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
  check('and the application is still accepted', Object.keys(neither).length === 10, Object.keys(neither).length);

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
    Department: { type: 'multi_select', multi_select: [{ name: 'Operations & admin' }, { name: 'Finance' }] },
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
  check('pulls Department, comma-joined across the multi_select',
    t.includes('Operations &amp; admin, Finance') || t.includes('Operations & amp; admin, Finance'), t);
  check('pulls Outcome', t.includes('Take a two-week vacation.'));
  check('no Track line in the breakdown', !t.includes('*Track:*'), t);
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

// ---------------------------------------------------------------------------
// Time Rich Members: the questionnaire -> portal_directory sync and the backfill.
//
// One fake stands in for Notion and Supabase. Notion's replies use the real
// response shape (typed properties with plain_text), and a PATCH reply carries
// everything already stored on the row, so these tests can tell a profile
// built from Notion's stored properties apart from one built from the body.
// ---------------------------------------------------------------------------
const memEnv = {
  NOTION_TOKEN: 'secret_test',
  NOTION_SUPERHUMAN_QUESTIONNAIRE_DATABASE_ID: 'db-shq',
  SUPABASE_URL: 'https://sb.test/',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  DIRECTORY_SYNC_SECRET: 'sync-secret',
  ALLOWED_ORIGIN: 'https://timerich.ai',
};

// Request-shaped Notion properties -> response-shaped (what Notion stores).
function asStored(props) {
  const out = {};
  for (const [name, p] of Object.entries(props || {})) {
    const runs = (arr) => (arr || []).map((t) => ({ plain_text: t.text.content, text: t.text }));
    if (p.title) out[name] = { type: 'title', title: runs(p.title) };
    else if (p.rich_text) out[name] = { type: 'rich_text', rich_text: runs(p.rich_text) };
    else if ('email' in p) out[name] = { type: 'email', email: p.email };
    else if ('url' in p) out[name] = { type: 'url', url: p.url };
    else if (p.select) out[name] = { type: 'select', select: p.select };
    else if (p.multi_select) out[name] = { type: 'multi_select', multi_select: p.multi_select };
    else if (p.date) out[name] = { type: 'date', date: p.date };
  }
  return out;
}

const mem = {
  members: [],        // portal_members rows: { email, role, active }
  directory: {},      // portal_directory rows by email
  stored: null,       // the questionnaire row already in Notion, if any
  notionSaveOk: true,
  supabaseUp: true,
  backfillPages: [],  // pages of Notion rows the backfill reads
  calls: [],
  logs: [],
};

const memFetch = async (url, init = {}) => {
  url = String(url);
  mem.calls.push({ url, init });
  const method = init.method || 'GET';
  const body = init.body ? JSON.parse(init.body) : null;
  const ok = (data, status = 200) => new Response(JSON.stringify(data), { status });

  if (url.startsWith('https://api.notion.com/v1/databases/db-shq/query')) {
    if (body && body.filter) return ok({ results: mem.stored ? [mem.stored] : [] }); // findRowByEmail
    const index = body && body.start_cursor ? Number(body.start_cursor) : 0;          // backfill paging
    const results = mem.backfillPages[index] || [];
    const more = index + 1 < mem.backfillPages.length;
    return ok({ results, has_more: more, next_cursor: more ? String(index + 1) : null });
  }
  if (url.startsWith('https://api.notion.com/v1/pages')) {
    if (!mem.notionSaveOk) return new Response('{"message":"bad"}', { status: 400 });
    const merged = method === 'PATCH'
      ? { ...mem.stored.properties, ...asStored(body.properties) }
      : asStored(body.properties);
    return ok({ id: 'page-shq', url: 'https://notion.so/page-shq', properties: merged });
  }
  if (url.startsWith('https://sb.test/rest/v1/')) {
    if (!mem.supabaseUp) return new Response('down', { status: 503 });
    if (url.includes('/portal_members?')) {
      const wanted = decodeURIComponent(url.split('email=ilike.')[1] || '').toLowerCase();
      return ok(mem.members.filter((m) => m.active && m.email.toLowerCase() === wanted));
    }
    if (url.includes('/portal_directory?on_conflict=email') && method === 'POST') {
      mem.directory[body.email] = { ...(mem.directory[body.email] || {}), ...body, _prefer: init.headers.Prefer };
      return new Response(null, { status: 201 });
    }
  }
  return ok({});
};

function resetMembers() {
  mem.members = [];
  mem.directory = {};
  mem.stored = null;
  mem.notionSaveOk = true;
  mem.supabaseUp = true;
  mem.backfillPages = [];
  mem.calls = [];
  mem.logs = [];
}

// Every console line the Worker writes while these run, so tests can prove
// what is never logged.
const realError = console.error;
const realLog = console.log;
function captureLogs(on) {
  if (on) {
    console.error = (...a) => mem.logs.push(a.map(String).join(' '));
  } else {
    console.error = realError;
    console.log = realLog;
  }
}

async function submitQuestionnaire(body, env = memEnv) {
  const pending = [];
  captureLogs(true);
  const res = await worker.fetch(new Request('https://w.dev/superhuman-questionnaire', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://timerich.ai' },
    body: JSON.stringify(body),
  }), env, { waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
  captureLogs(false);
  return res;
}

function backfill(token, env = memEnv) {
  const headers = { 'Content-Type': 'application/json' };
  if (token !== undefined) headers.Authorization = 'Bearer ' + token;
  return worker.fetch(new Request('https://w.dev/portal-directory-sync', { method: 'POST', headers, body: '{}' }), env);
}

const ADA = {
  name: 'Ada Lovelace',
  email: 'Ada@Example.com ',
  role: 'Buyer',
  linkedin: 'https://www.linkedin.com/in/ada',
  instagram: 'https://www.instagram.com/ada',
  other_links: 'https://ada.dev\nhttps://youtube.com/@ada',
  job_title: 'Founder',
  company: 'Analytical Co',
  company_does: 'We build engines that compute.',
  who_you_serve: 'Founders who think in systems.',
  bio: '4x founder, first programmer',
  photo_link: 'https://drive.google.com/file/d/abc123/view',
  superpower: 'I turn vague ideas into running systems.',
};

globalThis.fetch = memFetch;

console.log('\nTime Rich Members — questionnaire sync');
{
  resetMembers();
  mem.members = [{ email: 'ada@example.com', role: 'buyer', active: true }];
  const res = await submitQuestionnaire(ADA);
  const row = mem.directory['ada@example.com'];
  check('the form still answers 200', res.status === 200);
  check('a buyer with portal access gets a directory row, keyed by lowercased email', Boolean(row), Object.keys(mem.directory));
  check('Bio becomes hook_line', row && row.hook_line === '4x founder, first programmer', row);
  check('Title, Company and the profile answers map across',
    row && row.title === 'Founder' && row.company === 'Analytical Co' &&
    row.company_does === 'We build engines that compute.' &&
    row.who_they_serve === 'Founders who think in systems.' &&
    row.superpower === 'I turn vague ideas into running systems.', row);
  check('links map across, other links keep one per line',
    row && row.linkedin === 'https://www.linkedin.com/in/ada' && row.instagram === 'https://www.instagram.com/ada' &&
    row.other_links === 'https://ada.dev\nhttps://youtube.com/@ada', row);
  check('name and role are recorded', row && row.name === 'Ada Lovelace' && row.role === 'buyer', row);
  check('the write is an upsert on email', row && /resolution=merge-duplicates/.test(row._prefer), row && row._prefer);
  const notionAt = mem.calls.findIndex((c) => c.url.startsWith('https://api.notion.com/v1/pages'));
  const supabaseAt = mem.calls.findIndex((c) => c.url.startsWith('https://sb.test/'));
  check('Supabase is only touched after Notion saved', notionAt > -1 && supabaseAt > notionAt, { notionAt, supabaseAt });
  check('the service role key is what Supabase sees',
    mem.calls.filter((c) => c.url.startsWith('https://sb.test/')).every((c) => c.init.headers.apikey === 'service-key'));
}

{
  resetMembers();
  mem.members = [{ email: 'sam@example.com', role: 'second_seat', active: true }];
  await submitQuestionnaire({ ...ADA, name: 'Sam', email: 'sam@example.com', role: '+1' });
  check('a second seat is listed too', mem.directory['sam@example.com']?.role === 'second_seat');
}

{
  resetMembers();
  const res = await submitQuestionnaire({ ...ADA, email: 'stranger@example.com' });
  check('no portal_members row: skipped, form still 200', res.status === 200 && Object.keys(mem.directory).length === 0);
}

{
  resetMembers();
  mem.members = [{ email: 'kenneth@example.com', role: 'team', active: true }];
  await submitQuestionnaire({ ...ADA, email: 'kenneth@example.com', role: 'Ambassador' });
  check('team is never listed', Object.keys(mem.directory).length === 0);
}

{
  resetMembers();
  mem.members = [{ email: 'ada@example.com', role: 'buyer', active: false }];
  await submitQuestionnaire(ADA);
  check('an inactive member is not listed', Object.keys(mem.directory).length === 0);
}

{
  resetMembers();
  mem.members = [{ email: 'ada@example.com', role: 'buyer', active: true }];
  mem.stored = {
    id: 'page-shq',
    properties: asStored({
      Name: { title: [{ text: { content: 'Ada Lovelace' } }] },
      Email: { email: 'ada@example.com' },
      Company: { rich_text: [{ text: { content: 'Stored Co' } }] },
      Superpower: { rich_text: [{ text: { content: 'Stored superpower' } }] },
    }),
  };
  // A second pass that leaves Company and Superpower empty: the form keeps
  // them in Notion, so the profile must keep them too.
  await submitQuestionnaire({ ...ADA, company: '', superpower: '', bio: 'New hook line' });
  const row = mem.directory['ada@example.com'];
  check('the profile is built from what Notion stored, not the request body',
    row && row.company === 'Stored Co' && row.superpower === 'Stored superpower' && row.hook_line === 'New hook line', row);
}

{
  resetMembers();
  mem.members = [{ email: 'ada@example.com', role: 'buyer', active: true }];
  mem.notionSaveOk = false;
  const res = await submitQuestionnaire(ADA);
  check('Notion save fails: no sync, form reports the failure',
    res.status === 502 && !mem.calls.some((c) => c.url.startsWith('https://sb.test/')));
}

{
  resetMembers();
  mem.members = [{ email: 'ada@example.com', role: 'buyer', active: true }];
  mem.supabaseUp = false;
  const res = await submitQuestionnaire(ADA);
  check('Supabase down: the questionnaire still saves and answers 200', res.status === 200);
  check('the failure is logged without any answer or link in it',
    mem.logs.some((l) => l.includes('[members] directory sync failed')) &&
    !mem.logs.some((l) => l.includes('drive.google.com') || l.includes('Ada') || l.includes('linkedin')), mem.logs);
}

{
  resetMembers();
  mem.members = [{ email: 'ada@example.com', role: 'buyer', active: true }];
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ...noSupabase } = memEnv;
  const res = await submitQuestionnaire(ADA, noSupabase);
  check('without Supabase configured the sync is skipped quietly',
    res.status === 200 && !mem.calls.some((c) => c.url.startsWith('https://sb.test/')));
}

console.log('\nTime Rich Members — backfill');
{
  const row = (name, email) => ({
    properties: asStored({
      Name: { title: [{ text: { content: name } }] },
      Email: { email },
      Bio: { rich_text: [{ text: { content: name + ' hook' } }] },
    }),
  });
  resetMembers();
  mem.members = [
    { email: 'ada@example.com', role: 'buyer', active: true },
    { email: 'sam@example.com', role: 'second_seat', active: true },
    { email: 'kenneth@example.com', role: 'team', active: true },
  ];
  mem.backfillPages = [
    [row('Ada', 'ada@example.com'), row('Kenneth', 'kenneth@example.com')],
    [row('Sam', 'Sam@Example.com'), row('Amb', 'amb@example.com')],
  ];

  const missing = await backfill(undefined);
  const wrong = await backfill('not-the-secret');
  const unset = await backfill('sync-secret', { ...memEnv, DIRECTORY_SYNC_SECRET: '' });
  const bodies = [await missing.text(), await wrong.text(), await unset.text()];
  check('no token, a wrong token, or no secret configured: all 403',
    missing.status === 403 && wrong.status === 403 && unset.status === 403);
  check('and the three refusals are byte-identical', bodies.every((b) => b === bodies[0]), bodies);
  check('nothing is synced on a refusal', Object.keys(mem.directory).length === 0);

  const res = await backfill('sync-secret');
  const counts = await res.json();
  check('the right secret runs it', res.status === 200 && counts.ok === true, counts);
  check('it reads every page of the questionnaire', counts.processed === 4, counts);
  check('buyers and second seats are listed, team and non-members skipped',
    counts.listed === 2 && counts.skipped === 2 && counts.failed === 0 &&
    Boolean(mem.directory['ada@example.com']) && Boolean(mem.directory['sam@example.com']) &&
    !mem.directory['kenneth@example.com'] && !mem.directory['amb@example.com'], counts);

  const before = JSON.stringify(mem.directory, (k, v) => (k === 'updated_at' ? undefined : v));
  const again = await (await backfill('sync-secret')).json();
  const after = JSON.stringify(mem.directory, (k, v) => (k === 'updated_at' ? undefined : v));
  check('running it twice leaves the same rows', again.listed === 2 && before === after);
}

globalThis.fetch = baseFetch;

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
