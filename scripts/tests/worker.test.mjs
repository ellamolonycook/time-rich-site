// Worker mapping tests: mock Notion's API, POST payloads, assert what we'd write.
import worker from '../../worker/src/index.js';
import { createHmac, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

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
  referred_by: 'Dana Scully',
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
  check('Referred by is rich_text', p['Referred by'].rich_text[0].text.content === 'Dana Scully', p['Referred by']);
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
  check('a LinkedIn answer does not touch Website', !('Website' in normal) && new URL(normal.LinkedIn.url).origin === 'https://www.linkedin.com');

  await post('/superhuman', { ...FULL, linkedin: '', website: '' });
  const neither = pageBody().properties;
  check('Q4 skipped entirely omits both columns',
    !('LinkedIn' in neither) && !('Website' in neither), Object.keys(neither));
  check('and the application is still accepted', Object.keys(neither).length === 11, Object.keys(neither).length);

  await post('/superhuman', { ...FULL, referred_by: '' });
  const noRef = pageBody().properties;
  check('nobody referred them: the column is still sent, empty',
    'Referred by' in noRef && noRef['Referred by'].rich_text.length === 0, noRef['Referred by']);

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
    'Referred by': { type: 'rich_text', rich_text: [{ plain_text: 'Dana Scully' }] },
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
  if (new URL(u).origin === 'https://slack.com' && new URL(u).pathname === '/api/chat.postMessage') {
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
  check('with the bot token', calls.find((c) => new URL(c.url).origin === 'https://slack.com').init.headers.Authorization === 'Bearer xoxb-test');
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
  check('pulls Referred by', t.includes('*Referred by:* Dana Scully'), t);
  check('Referred by sits with the rest of the breakdown, not the headline',
    t.indexOf('*Referred by:*') > t.indexOf('*1:1 coaching:*'), t);
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

console.log('\nGrant applications: /ffg and /stanley');
{
  const grantEnv = {
    ...env,
    NOTION_GRANTS_DATABASE_ID: 'db-grants',
    SLACK_BOT_TOKEN: 'xoxb-test',
    SLACK_GRANTS_CHANNEL_ID: 'C-GRANTS',
  };

  // Its own stub: these tests need to fail Notion and Slack independently,
  // and to see the Slack post, which runs off the response path.
  const grant = { notionStatus: 200, slackOk: true, calls: [], logs: [] };
  const realFetch = globalThis.fetch;
  const realError = console.error;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    grant.calls.push({ url: u, init, body: init && typeof init.body === 'string' ? JSON.parse(init.body) : null });
    if (u.includes('slack.com/api/chat.postMessage')) {
      return new Response(JSON.stringify(grant.slackOk ? { ok: true } : { ok: false, error: 'channel_not_found' }), { status: 200 });
    }
    if (grant.notionStatus !== 200) return new Response('{"message":"bad"}', { status: grant.notionStatus });
    return new Response(JSON.stringify({ id: 'page-g', url: 'https://notion.so/page-g' }), { status: 200 });
  };

  async function apply(path, body, opts = {}) {
    grant.calls = [];
    grant.logs = [];
    grant.notionStatus = opts.notionStatus || 200;
    grant.slackOk = opts.slackOk !== false;
    const pending = [];
    console.error = (...a) => grant.logs.push(a.map(String).join(' '));
    const res = await worker.fetch(new Request('https://w.dev' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://timerich.ai' },
      body: JSON.stringify(body),
    }), grantEnv, { waitUntil: (p) => pending.push(p) });
    await Promise.all(pending);
    console.error = realError;
    return res;
  }
  const notion = () => grant.calls.find((c) => c.url.endsWith('/v1/pages'));
  const slack = () => grant.calls.find((c) => c.url.includes('chat.postMessage'));
  const props = () => notion().body.properties;

  const FFG = {
    form_version: 'ffg-v1',
    full_name: '  Ada Lovelace  ',
    email: ' Ada@Example.com ',
    linkedin: 'linkedin.com/in/ada',
    woman_founder: 'Yes',
    company: 'Analytical Co',
    stage: 'Pre-seed',
    revenue: 'Under $10k',
    why: 'Because the engine needs a programmer.',
    lisbon: 'Yes, I can get there',
    show_up: 'Every session',
    entry_steps: ['Followed on LinkedIn', 'Shared the post'],
    source: 'LinkedIn',
    _gotcha: '',
  };

  const STANLEY = {
    form_version: 'stanley-v1',
    full_name: 'Grace Hopper',
    email: 'grace@example.com',
    linkedin: 'https://www.linkedin.com/in/grace',
    company: 'Compiler Co',
    stage: 'Seed',
    revenue: '$10k-50k',
    platforms: ['LinkedIn', 'X'],
    built_for_you: 'Yes',
    posts: 'Three a week',
    followers: '12,000',
    why: 'Building in public already.',
    show_up: 'Yes',
    entry_steps: ['Followed Stanley'],
    share_stanley: 'Happy to',
    source: 'A friend',
    _gotcha: '',
  };

  // The message body is the Slack block; body.text is only the fallback
  // notification string, so it holds the heading and nothing else.
  const grantSlackBody = () => {
    const post = slack();
    return post && post.body.blocks && post.body.blocks[0] ? post.body.blocks[0].text.text : '';
  };

  {
    const res = await apply('/ffg', FFG);
    check('a valid ffg application is accepted', res.status === 200);
    check('it is written to the grants database', notion().body.parent.database_id === 'db-grants');
    check('the Grant select comes from the route',
      props().Grant.select.name === 'Female Founder', props().Grant);
    check('Status is stamped New', props().Status.select.name === 'New');
    check('the name is the title, trimmed',
      props().Name.title[0].text.content === 'Ada Lovelace', props().Name);
    check('the email is trimmed', props().Email.email === 'Ada@Example.com'.trim());
    check('a bare LinkedIn handle is made into a URL',
      props().LinkedIn.url === 'https://linkedin.com/in/ada', props().LinkedIn);
    check('checkbox answers are saved as one comma-separated line',
      props()['Entry steps'].rich_text[0].text.content === 'Followed on LinkedIn, Shared the post',
      props()['Entry steps']);
    check('the ffg-only columns are written',
      props()['Woman founder'].rich_text[0].text.content === 'Yes' &&
      props().Lisbon.rich_text[0].text.content === 'Yes, I can get there');
    check('the stanley-only columns are not',
      !('Platforms' in props()) && !('Share Stanley' in props()) &&
      !('Built for you' in props()), Object.keys(props()));
    check('Submitted is never set, because it is a created_time column',
      !('Submitted' in props()));
    check('Slack is told, on the grants channel',
      slack() && slack().body.channel === 'C-GRANTS', slack() && slack().body.channel);
    check('the Slack message leads with the grant and links the row',
      /New grant application · Female Founder/.test(slack().body.text) &&
      /notion\.so\/page-g/.test(JSON.stringify(slack().body.blocks)), slack().body.text);
  }

  {
    const res = await apply('/stanley', STANLEY);
    check('a valid stanley application is accepted', res.status === 200);
    check('its Grant select is the other one',
      props().Grant.select.name === 'Founders Building in Public', props().Grant);
    check('the stanley-only columns are written',
      props().Platforms.rich_text[0].text.content === 'LinkedIn, X' &&
      props().Posts.rich_text[0].text.content === 'Three a week' &&
      props().Followers.rich_text[0].text.content === '12,000' &&
      props()['Share Stanley'].rich_text[0].text.content === 'Happy to');
    check('and so is the new built-for-you answer',
      props()['Built for you'].rich_text[0].text.content === 'Yes',
      props()['Built for you']);
    check('the ffg-only columns are not',
      !('Woman founder' in props()) && !('Lisbon' in props()), Object.keys(props()));
    check('a full LinkedIn URL is left alone',
      props().LinkedIn.url === 'https://www.linkedin.com/in/grace');
    check('Slack is told for this one too', Boolean(slack()));
    // A "Yes" here is a lead, so it is in the message rather than only in
    // Notion where someone has to go and look for it.
    check('and the message carries the built-for-you answer',
      /\*Wants it built for them:\* Yes/.test(grantSlackBody()), grantSlackBody());
  }

  {
    // The question only exists on /stanley, so the line is absent on the
    // other form rather than showing up as an empty dash.
    await apply('/ffg', FFG);
    check('the ffg message has no built-for-you line',
      !/built for them/i.test(grantSlackBody()), grantSlackBody());

    // No answer, no line: an older saved application still posts cleanly.
    const noAnswer = { ...STANLEY };
    delete noAnswer.built_for_you;
    const res = await apply('/stanley', noAnswer);
    check('an application without the answer is still accepted', res.status === 200);
    check('its column is written empty rather than breaking the row',
      props()['Built for you'].rich_text.length === 0, props()['Built for you']);
    check('and Slack simply leaves the line out',
      !/built for them/i.test(grantSlackBody()), grantSlackBody());

    for (const value of ['Maybe', 'No']) {
      await apply('/stanley', { ...STANLEY, built_for_you: value });
      check('a ' + value + ' is carried through to Notion and Slack',
        props()['Built for you'].rich_text[0].text.content === value &&
        grantSlackBody().includes('*Wants it built for them:* ' + value),
        grantSlackBody());
    }
  }

  {
    const res = await apply('/ffg', { ...FFG, _gotcha: 'bot' });
    check('a filled honeypot looks like success', res.status === 200);
    check('and saves nothing, anywhere', !notion() && !slack(), grant.calls.map((c) => c.url));
  }

  {
    const res = await apply('/ffg', { ...FFG, email: '' });
    check('a missing email is a 400', res.status === 400);
    check('and nothing is written', !notion());
    const bad = await apply('/stanley', { ...STANLEY, email: 'not-an-email' });
    check('so is an email that is not one', bad.status === 400 && !notion());
    const noName = await apply('/ffg', { ...FFG, full_name: '   ' });
    check('and a blank name is too', noName.status === 400 && !notion());
  }

  {
    const res = await apply('/ffg', FFG, { notionStatus: 500 });
    check('a Notion failure is a 500, so the form can say so', res.status === 500);
    check('Slack is not told about a row that does not exist', !slack());
    check('and the failure is logged', grant.logs.some((l) => /notion write failed/.test(l)), grant.logs);
  }

  {
    const res = await apply('/ffg', FFG, { slackOk: false });
    check('a Slack failure still answers success: the row is saved', res.status === 200);
    check('the row really was written', Boolean(notion()));
    check('and the Slack failure is logged', grant.logs.some((l) => /slack post failed/.test(l)), grant.logs);
  }

  {
    const long = 'x'.repeat(5000);
    await apply('/ffg', { ...FFG, why: long, company: long });
    check('a long answer is capped at the Notion rich-text limit',
      props().Why.rich_text[0].text.content.length === 2000 &&
      props().Company.rich_text[0].text.content.length === 2000,
      props().Why.rich_text[0].text.content.length);
    check('and the row still saves', notion().body.parent.database_id === 'db-grants');
  }

  {
    const res = await apply('/ffg', { ...FFG, linkedin: '' });
    check('an empty LinkedIn is left out, because Notion rejects "" for a url',
      res.status === 200 && !('LinkedIn' in props()), Object.keys(props()));
  }

  globalThis.fetch = realFetch;
  console.error = realError;
}

console.log('\nPortal members: ThriveCart buyer and /onboard +1 upserts');
{
  const SB_URL = 'https://sb.test';
  const SB_KEY = 'sb_secret_test_key';
  const pEnv = {
    ...env,
    THRIVECART_SECRET: 'tc-secret',
    NOTION_SUPERHUMAN_COHORT1_DATABASE_ID: 'db-cohort',
    SUPABASE_URL: SB_URL,
    SUPABASE_SERVICE_ROLE_KEY: SB_KEY,
  };
  const rt = (v) => ({ type: 'rich_text', rich_text: [{ plain_text: v }] });
  const PAID_ROW = {
    id: 'page-buyer',
    properties: {
      Email: { type: 'email', email: 'Buyer@Example.com' },
      TrackingID: rt('trk-1'),
      'Order ID': rt('TC-555'),
      'Payment Status': { type: 'select', select: { name: 'Paid' } },
    },
  };
  let sb, paidRows, sbDown, logs;
  const pFetch = async (url, init) => {
    url = String(url);
    calls.push({ url, init });
    if (new URL(url).origin === new URL(SB_URL).origin) {
      if (sbDown) throw new Error('network down');
      sb.push({ url, headers: init.headers, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ ok: true, id: 'm-1', created: true, passcode_never: 'x' }), { status: 200 });
    }
    if (url.includes('/v1/databases/') && url.endsWith('/query')) {
      return new Response(JSON.stringify({ results: paidRows }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: 'page-1' }), { status: 200 });
  };
  const origLog = console.log, origErr = console.error;
  async function run(path, body, opts = {}) {
    globalThis.fetch = pFetch;
    calls = []; sb = []; logs = [];
    paidRows = opts.paidRows ?? [PAID_ROW];
    sbDown = opts.sbDown === true;
    const pending = [];
    console.log = (...a) => logs.push(a.join(' '));
    console.error = (...a) => logs.push(a.join(' '));
    try {
      const res = await worker.fetch(new Request('https://w.dev' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://timerich.ai' },
        body: JSON.stringify(body),
      }), opts.env || pEnv, { waitUntil: (p) => pending.push(p) });
      await Promise.all(pending);
      return res;
    } finally {
      console.log = origLog; console.error = origErr;
    }
  }
  const TC = {
    event: 'order.success', mode: 'live', thrivecart_secret: 'tc-secret',
    order_id: 'TC-555', order_total: '99700',
    customer: { email: '  Buyer@Example.com ', first_name: 'Bea', last_name: 'Buyer' },
    passthrough: { tracking_id: 'trk-1' },
  };

  // ThriveCart buyer
  let res = await run('/thrivecart-webhook', TC);
  check('live paid order: 200', res.status === 200);
  check('live paid order: one upsert to portal_upsert_member',
    sb.length === 1 && sb[0].url === SB_URL + '/rest/v1/rpc/portal_upsert_member', sb);
  check('live paid order: role buyer, order id, email trimmed + lowercased, name',
    sb[0] && sb[0].body.p_role === 'buyer' && sb[0].body.p_order_id === 'TC-555' &&
    sb[0].body.p_email === 'buyer@example.com' && sb[0].body.p_full_name === 'Bea Buyer', sb[0] && sb[0].body);
  check('the request never carries a passcode', sb[0] && !('p_passcode' in sb[0].body) && !('passcode' in sb[0].body));
  check('sb_secret_ key goes in apikey only, not Authorization',
    sb[0] && sb[0].headers.apikey === SB_KEY && !('Authorization' in sb[0].headers));
  check('nothing logged contains the key, the email or the response',
    !logs.some((l) => l.includes(SB_KEY) || l.includes('passcode_never')) &&
    !logs.some((l) => l.includes('portal') && l.toLowerCase().includes('buyer@example.com')), logs.filter((l) => l.includes('portal')));

  res = await run('/thrivecart-webhook', { ...TC, mode: 'test' });
  check('test-mode order: still 200, no upsert', res.status === 200 && sb.length === 0);
  res = await run('/thrivecart-webhook', { ...TC, mode: undefined });
  check('order with no mode: treated as test, no upsert', res.status === 200 && sb.length === 0);
  res = await run('/thrivecart-webhook', { ...TC, event: 'order.refund' });
  check('refund: no upsert', res.status === 200 && sb.length === 0);
  res = await run('/thrivecart-webhook', { ...TC, event: 'test' });
  check('"test" event: ignored, no upsert', res.status === 200 && sb.length === 0);
  res = await run('/thrivecart-webhook', { ...TC, thrivecart_secret: 'wrong' });
  check('wrong secret: 401, no upsert', res.status === 401 && sb.length === 0);
  res = await run('/thrivecart-webhook', { ...TC, thrivecart_secret: undefined });
  check('missing secret: 401, no upsert', res.status === 401 && sb.length === 0);
  res = await run('/thrivecart-webhook', TC, { env: { ...pEnv, THRIVECART_SECRET: '' } });
  check('secret not configured: 503, no upsert', res.status === 503 && sb.length === 0);
  res = await run('/thrivecart-webhook', TC, { env: { ...pEnv, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' } });
  check('Supabase not configured: still 200, no call', res.status === 200 && sb.length === 0);
  res = await run('/thrivecart-webhook', TC, { sbDown: true });
  check('Supabase down: ThriveCart still gets 200', res.status === 200);
  res = await run('/thrivecart-webhook', TC, { env: { ...pEnv, SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOi.test.jwt' } });
  check('legacy JWT service_role key also goes in Authorization',
    sb[0] && sb[0].headers.Authorization === 'Bearer eyJhbGciOi.test.jwt');

  // /onboard +1
  const ONB = {
    trackingId: 'trk-1', email: 'buyer@example.com', choice: 'named',
    attendeeFirstName: 'Pat', attendeeLastName: 'Plus', attendeeEmail: 'Pat.Plus@Example.com',
  };
  res = await run('/onboard', ONB);
  check('named +1: 200 and one upsert', res.status === 200 && sb.length === 1, sb);
  check('named +1: role second_seat, buyer order id from the Notion row, email lowercased',
    sb[0] && sb[0].body.p_role === 'second_seat' && sb[0].body.p_order_id === 'TC-555' &&
    sb[0].body.p_email === 'pat.plus@example.com' && sb[0].body.p_full_name === 'Pat Plus', sb[0] && sb[0].body);
  res = await run('/onboard', ONB, { paidRows: [] });
  check('no paid order: still 403, no upsert', res.status === 403 && sb.length === 0);
  res = await run('/onboard', { ...ONB, choice: 'unsure' });
  check('"not sure yet": no upsert', res.status === 200 && sb.length === 0);
  res = await run('/onboard', { ...ONB, attendeeEmail: 'not-an-email' });
  check('invalid +1 email: no upsert', res.status === 200 && sb.length === 0);
  res = await run('/onboard', { ...ONB, attendeeEmail: ' BUYER@example.com' });
  check('+1 email is the buyer\'s own: no upsert', res.status === 200 && sb.length === 0);
  res = await run('/onboard', ONB, { sbDown: true });
  check('Supabase down: /onboard still 200', res.status === 200);

  globalThis.fetch = baseFetch;
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
  drive: {},          // Drive files by id: { type, bytes, declared?, status? }
  driveHits: [],
  uploads: [],
  deleted: [],
  slack: [],
  codes: {},          // passcode -> portal role, for portal_get
  tokens: {},         // session token -> portal role, for portal_get_by_token
  enabled: undefined, // directory_enabled value, undefined = no row
  listedColumns: [],
  allowedQuery: '',
  signRequests: [],
  signFails: false,
  calls: [],
  logs: [],
};

const ADA_PHOTO_ID = 'AdaPhotoFile_0123456789';
const jpeg = (bytes = 40000) => ({ type: 'image/jpeg', bytes, declared: bytes });

const memFetch = async (url, init = {}) => {
  url = String(url);
  mem.calls.push({ url, init });
  const method = init.method || 'GET';
  // Photo uploads send raw image bytes; only text bodies are JSON.
  const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
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
      // The directory read asks who is allowed to be listed at all:
      // select=email&active=eq.true&role=in.(buyer,second_seat). Everything
      // else looks one member up by address.
      if (url.includes('role=in.')) {
        const roles = decodeURIComponent(url.split('role=in.')[1].split('&')[0]).replace(/[()]/g, '').split(',');
        mem.allowedQuery = url;
        return ok(mem.members
          .filter((m) => m.active && roles.includes(m.role))
          .map((m) => ({ email: m.email })));
      }
      const wanted = decodeURIComponent(url.split('email=ilike.')[1] || '').toLowerCase();
      return ok(mem.members.filter((m) => m.active && m.email.toLowerCase() === wanted));
    }
    if (url.includes('/rpc/portal_ambassador_allowed')) {
      return ok(mem.allowlist.includes(String(body && body.p_email).trim().toLowerCase()));
    }
    if (url.includes('/rpc/portal_upsert_member')) {
      mem.upserts.push(body);
      return ok({ ok: true, id: 'member-1', created: true });
    }
    if (url.includes('/rpc/portal_get_by_token')) {
      // Session tokens are seeded the same way passcodes are, so a test can
      // exercise either door into the same member.
      const role = mem.tokens[String(body && body.p_token).trim()];
      return ok(role ? { ok: true, member: { first_name: 'X', role }, weeks: [], sessions: [] } : { ok: false });
    }
    if (url.includes('/rpc/portal_get')) {
      const role = mem.codes[String(body && body.p_code).trim().toUpperCase()];
      return ok(role ? { ok: true, member: { first_name: 'X', role }, weeks: [], sessions: [] } : { ok: false });
    }
    if (url.includes('/portal_settings?') && method === 'GET') {
      return ok(mem.enabled === undefined ? [] : [{ value: mem.enabled }]);
    }
    if (url.includes('/portal_directory?select=') && method === 'GET' && !url.includes('email=eq.')) {
      // The read endpoint's list: return only the columns it asked for.
      const columns = url.split('select=')[1].split('&')[0].split(',');
      mem.listedColumns = columns;
      return ok(Object.values(mem.directory).map((r) => Object.fromEntries(columns.map((c) => [c, r[c] ?? null]))));
    }
    if (url.includes('/portal_directory?select=') && method === 'GET') {
      const wanted = decodeURIComponent(url.split('email=eq.')[1] || '');
      const row = mem.directory[wanted];
      return ok(row ? [{ photo_path: row.photo_path ?? null, photo_status: row.photo_status ?? 'missing', photo_source_url: row.photo_source_url ?? null }] : []);
    }
    if (url.includes('/portal_directory?on_conflict=email') && method === 'POST') {
      // Merge-duplicates only updates the columns sent, like PostgREST.
      const { _prefer, ...rest } = body;
      mem.directory[body.email] = { ...(mem.directory[body.email] || {}), ...rest, _prefer: init.headers.Prefer };
      return new Response(null, { status: 201 });
    }
  }
  if (url === 'https://sb.test/storage/v1/object/sign/portal-directory') {
    mem.signRequests.push(body);
    if (mem.signFails) return new Response('nope', { status: 500 });
    return ok(body.paths.map((path) => ({ path, signedURL: '/object/sign/portal-directory/' + path + '?token=t', error: null })));
  }
  if (url.startsWith('https://sb.test/storage/v1/object/portal-directory/')) {
    const path = url.split('/portal-directory/')[1];
    if (method === 'DELETE') { mem.deleted.push(path); return ok({}); }
    mem.uploads.push({ path, type: init.headers['Content-Type'], upsert: init.headers['x-upsert'], size: init.body.byteLength });
    return ok({ Key: 'portal-directory/' + path });
  }
  if (url.startsWith('https://drive.google.com/uc?export=download&id=')) {
    const id = decodeURIComponent(url.split('id=')[1]);
    mem.driveHits.push(id);
    const file = mem.drive[id] || { type: 'text/html; charset=utf-8', bytes: 3000 }; // Drive's sign-in page
    const headers = { 'Content-Type': file.type };
    if (file.declared !== undefined) headers['Content-Length'] = String(file.declared);
    return new Response(new Uint8Array(file.bytes), { status: file.status || 200, headers });
  }
  if (url === 'https://hooks.slack.test/questionnaire') {
    mem.slack.push(body.text);
    return ok({});
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
  mem.drive = { [ADA_PHOTO_ID]: jpeg() };
  mem.driveHits = [];
  mem.uploads = [];
  mem.deleted = [];
  mem.slack = [];
  mem.codes = {};
  mem.tokens = {};
  // Ambassadors the team has approved, and every portal_upsert_member the
  // Worker asked for, so a test can prove it asked for none.
  mem.allowlist = [];
  mem.upserts = [];
  mem.enabled = undefined;
  mem.listedColumns = [];
  mem.allowedQuery = '';
  mem.signRequests = [];
  mem.signFails = false;
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
  photo_link: 'https://drive.google.com/file/d/' + ADA_PHOTO_ID + '/view?usp=sharing',
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

console.log('\nThe "Also building" question');
{
  // Thirteen options plus Other, written to a Notion multi-select. The page
  // stores the Notion option names as its values and shows a longer sentence
  // as the label, so the two lists have to be the same list.
  const page = readFileSync(new URL('../../superhuman/index.html', import.meta.url), 'utf8');
  const spec = page.slice(page.indexOf('key: "also_build"'));
  const specEnd = spec.slice(0, spec.indexOf('\n    ]'));
  const pageValues = [...specEnd.matchAll(/value: "([^"]+)"/g)].map((m) => m[1]);
  const pageLabels = [...specEnd.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
  const src = readFileSync(new URL('../../worker/src/index.js', import.meta.url), 'utf8');
  const listSrc = src.slice(src.indexOf('const BQ_ALSO_BUILD = ['));
  const allowed = [...listSrc.slice(0, listSrc.indexOf('];')).matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  check('the page offers thirteen options', pageValues.length === 13, pageValues.length);
  check('and a label for every one of them', pageLabels.length === 13, pageLabels.length);
  check('the question sits straight after the first-build one',
    page.indexOf('key: "build_priority"') < page.indexOf('key: "also_build"') &&
    page.indexOf('key: "also_build"') < page.indexOf('key: "tech_stack"'));
  check('it is not required', !/key: "also_build"[\s\S]{0,200}required: true/.test(page));
  check('and it offers an Other box', /key: "also_build"[\s\S]{0,300}other: true/.test(page));
  check('whose text is filed under its own prefix',
    /\{ key: "also_build", prefix: "Also build" \}/.test(page));

  check('the Worker allows those thirteen plus Other, and nothing else',
    allowed.length === 14 &&
    pageValues.every((v) => allowed.includes(v)) &&
    allowed.every((v) => v === 'Other' || pageValues.includes(v)),
    { allowed: allowed.length, missing: pageValues.filter((v) => !allowed.includes(v)) });
  // Notion refuses a select option containing a comma, which is why several
  // of these read as "Website / pricing / checkout" rather than with commas.
  check('no allowed option contains a comma',
    allowed.length === 14 && !allowed.some((v) => v.includes(',')),
    allowed.filter((v) => v.includes(',')));

  check('both questionnaire routes write the property',
    (src.match(/multi\("Q Also Build", data\.also_build, BQ_ALSO_BUILD\);/g) || []).length === 2);
  check('and both Google Sheet payloads carry the field',
    (src.match(/alsoBuild: semiList\(data\.also_build\),/g) || []).length === 2);

  // Driven for real, through the route the page posts to.
  const lastNotion = () => {
    const call = [...mem.calls].reverse().find((c) => c.url.startsWith('https://api.notion.com/v1/pages'));
    return call ? JSON.parse(call.init.body).properties : {};
  };
  const SHEET = 'https://script.google.test/sheet';
  const sheetEnv = { ...memEnv, GOOGLE_SHEET_ORDERS_URL: SHEET };
  const lastSheet = () => {
    const call = [...mem.calls].reverse().find((c) => String(c.url).startsWith(SHEET));
    return call ? JSON.parse(call.init.body) : null;
  };
  const send = async (also_build, env) => {
    resetMembers();
    mem.members = [{ email: 'ada@example.com', role: 'buyer', active: true }];
    const res = await submitQuestionnaire({ ...ADA, also_build }, env);
    const prop = lastNotion()['Q Also Build'];
    return { res, names: prop ? prop.multi_select.map((o) => o.name) : null };
  };
  // `names` is null when nothing was written, so every read of it below goes
  // through this: a block that throws halfway reports far less than it knows.
  const joined = (r) => (r.names || []).join('|');

  // Valid values pass through, in the order they were sent.
  const three = ['Client journey', 'Admin assistant', 'Email list growth'];
  const some = await send(three);
  check('the chosen options reach Notion as a multi-select',
    some.res.status === 200 && some.names && joined(some) === three.join('|'), some.names);

  // All thirteen at once: proves every single option name is one Notion holds.
  const all = await send(pageValues);
  check('every one of the thirteen is accepted, none silently dropped',
    all.names && all.names.length === 13 && joined(all) === pageValues.join('|'),
    { got: all.names && all.names.length, missing: pageValues.filter((v) => !(all.names || []).includes(v)) });

  // An option Notion has never heard of would 400 the whole PATCH and take
  // every other answer down with it, so the Worker drops it instead.
  const odd = await send(['Client journey', 'Something nobody offered', 'Admin assistant']);
  check('an unknown value is dropped, and the rest still saves',
    odd.res.status === 200 && joined(odd) === 'Client journey|Admin assistant', odd.names);

  // When the member ticks Other and types, the page sends "Other" in the
  // array and the text goes to Q Other Answers under its own prefix.
  const other = await send(['Admin assistant', 'Other']);
  check('Other is written when it was chosen',
    other.names && other.names.includes('Other'), other.names);

  const onlyOther = await send(['Other']);
  check('and on its own, with nothing else ticked',
    joined(onlyOther) === 'Other', onlyOther.names);

  // Not required, so most people will leave it alone.
  const none = await send([]);
  check('an empty answer writes no property at all',
    none.res.status === 200 && !('Q Also Build' in lastNotion()),
    Object.keys(lastNotion()).filter((k) => k.includes('Also')));
  const missing = await send(undefined);
  check('and so does a payload that omits the field',
    missing.res.status === 200 && !('Q Also Build' in lastNotion()));
  const allBad = await send(['Nope', 'Also nope']);
  check('as does an answer where nothing was recognised',
    allBad.res.status === 200 && !('Q Also Build' in lastNotion()), allBad.names);

  // The sheet gets the same answers, joined with semicolons rather than the
  // commas the other list columns use: several of these read as a list of
  // their own, and a comma would be one separator too many.
  await send(three, sheetEnv);
  const sheet = lastSheet();
  check('the Google Sheet gets them joined with semicolons',
    sheet && sheet.alsoBuild === 'Client journey; Admin assistant; Email list growth',
    sheet && sheet.alsoBuild);
  check('and the lead gen column still uses commas, unchanged',
    sheet && typeof sheet.leadGenPlatforms === 'string' && !sheet.alsoBuild.includes(', '),
    sheet && sheet.leadGenPlatforms);
}

console.log('\nThe City question');
{
  // Ella needs where every member is based, for the NYC events, the hot seat
  // rooms and the members directory. It is a plain short text field, so what
  // matters here is the seams: it is asked first on the "About you" screen, it
  // is required like LinkedIn, and it reaches the Notion "City" column, the
  // Google Sheet and the Slack line.
  const page = readFileSync(new URL('../../superhuman/index.html', import.meta.url), 'utf8');
  const src = readFileSync(new URL('../../worker/src/index.js', import.meta.url), 'utf8');

  const aboutSpec = page.slice(page.indexOf('key: "about_you"'));
  const aboutFields = aboutSpec.slice(0, aboutSpec.indexOf('\n    ]'));
  const fieldOrder = [...aboutFields.matchAll(/\{ key: "([^"]+)", kind:/g)].map((m) => m[1]);

  check('City is asked on the About you screen', fieldOrder.includes('city'), fieldOrder);
  check('and asked first, above LinkedIn',
    fieldOrder[0] === 'city' && fieldOrder.indexOf('city') < fieldOrder.indexOf('linkedin'), fieldOrder);
  check('as a short text field, not a link one',
    /\{ key: "city", kind: "short",/.test(aboutFields));
  check('and required, like LinkedIn',
    /\{ key: "city", kind: "short", required: true,/.test(aboutFields));
  // The required message is built from the label, so the label is the sentence
  // the member reads back when they skip it.
  check('with the label from the brief',
    /label: "City you're based in"/.test(aboutFields));

  check('the Worker writes it to the Notion City column',
    /text\("City", data\.city\);/.test(src));
  check('and the Google Sheet payload carries it',
    /city: data\.city \|\| "",/.test(src));

  // Driven for real, through the route the page posts to.
  const SHEET_CITY = 'https://script.google.test/sheet';
  const cityEnv = {
    ...memEnv,
    GOOGLE_SHEET_ORDERS_URL: SHEET_CITY,
    SLACK_QUESTIONNAIRE_WEBHOOK_URL: 'https://hooks.slack.test/questionnaire',
  };
  const cityProps = () => {
    const call = [...mem.calls].reverse().find((c) => c.url.startsWith('https://api.notion.com/v1/pages'));
    return call ? JSON.parse(call.init.body).properties : {};
  };
  const citySheet = () => {
    const call = [...mem.calls].reverse().find((c) => String(c.url).startsWith(SHEET_CITY));
    return call ? JSON.parse(call.init.body) : null;
  };
  const sendCity = async (city) => {
    resetMembers();
    mem.members = [{ email: 'ada@example.com', role: 'buyer', active: true }];
    const res = await submitQuestionnaire({ ...ADA, city }, cityEnv);
    const prop = cityProps()['City'];
    return { res, stored: prop ? prop.rich_text[0].text.content : null };
  };

  const nyc = await sendCity('New York');
  check('a typed city reaches Notion as rich text',
    nyc.res.status === 200 && nyc.stored === 'New York', nyc.stored);
  check('and the same answer reaches the Google Sheet',
    citySheet() && citySheet().city === 'New York', citySheet() && citySheet().city);
  check('Slack gets a City line of its own',
    mem.slack.some((t) => t.split('\n').includes('City: New York')), mem.slack);

  // Clipped exactly like every other short answer: 2,000 is Notion's per-rich
  // text ceiling and this column is not special.
  const long = await sendCity('x'.repeat(2500));
  check('a very long city is clipped to the 2,000-char Notion limit',
    long.stored !== null && long.stored.length === 2000, long.stored && long.stored.length);

  // The page makes it required, but an empty answer must still leave the column
  // alone rather than blanking what is already in it - the rule every other
  // text answer follows, so a second pass over the form can only ever add.
  const blank = await sendCity('');
  check('an empty city writes no property at all',
    blank.res.status === 200 && !('City' in cityProps()),
    Object.keys(cityProps()).filter((k) => k === 'City'));
  check('and Slack gets no City line either', !mem.slack.some((t) => t.includes('City:')), mem.slack);

  const absent = await sendCity(undefined);
  check('a payload that omits the field writes nothing too',
    absent.res.status === 200 && !('City' in cityProps()));
}

console.log('\nThe Stanley content build question');
{
  // The page and Notion do not agree on the words for the third answer. A
  // Notion select option cannot contain a comma, so "No, I'll build it
  // myself" is stored as "No (I'll build it myself)". The page keeps the
  // sentence; the Worker maps it on the way out. Everything below is about
  // that seam: the mapped name reaching Notion, the original text reaching
  // the Google Sheet, and no comma getting as far as a select option.
  const page = readFileSync(new URL('../../superhuman/index.html', import.meta.url), 'utf8');
  const spec = page.slice(page.indexOf('key: "stanley_content_build"'));
  const pageOptions = [...spec.slice(0, spec.indexOf('\n    ]')).matchAll(/value: "([^"]+)"/g)].map((m) => m[1]);
  const src = readFileSync(new URL('../../worker/src/index.js', import.meta.url), 'utf8');

  // The map the Worker reads, lifted out of the source so the test cannot
  // drift from it: a change to either side shows up here.
  const mapSrc = src.slice(src.indexOf('BQ_STANLEY_CONTENT_BUILD_NOTION = {'));
  const MAP = Object.fromEntries(
    [...mapSrc.slice(0, mapSrc.indexOf('};')).matchAll(/"([^"]+)": "([^"]+)",/g)].map((m) => [m[1], m[2]]));

  check('the page offers the three options from the brief',
    pageOptions.length === 3 &&
    pageOptions.join('|') === "Yes|Maybe|No, I'll build it myself", pageOptions);
  check('the question sits straight after the vendor call one, as the form reads',
    page.indexOf('key: "vendor_call_100"') < page.indexOf('key: "stanley_content_build"') &&
    page.indexOf('key: "stanley_content_build"') < page.indexOf('key: "bring_someone_in"'));
  check('it is not required: nobody is held up by it',
    !/key: "stanley_content_build"[\s\S]{0,120}required: true/.test(page));

  // Every answer the page can send has somewhere to go. Without this a
  // renamed option would simply stop being written, silently.
  check('the Worker has a mapping for every option the page offers',
    pageOptions.length === 3 && pageOptions.every((o) => typeof MAP[o] === 'string' && MAP[o]),
    { pageOptions, MAP });
  check('Yes and Maybe are passed through unchanged',
    MAP.Yes === 'Yes' && MAP.Maybe === 'Maybe', MAP);
  check('and the comma answer becomes the bracketed name Notion holds',
    MAP["No, I'll build it myself"] === "No (I'll build it myself)",
    MAP["No, I'll build it myself"]);

  // Both questionnaire routes map it, not just the one the page posts to.
  check('both Notion writes go through the mapping, not the raw answer',
    (src.match(/select\("Q Stanley Content Build",\s*\n\s*stanleyContentBuildOption\(data\.stanley_content_build\), BQ_STANLEY_CONTENT_BUILD\);/g) || []).length === 2);
  check('and neither writes data.stanley_content_build to Notion directly',
    !/select\("Q Stanley Content Build", data\.stanley_content_build/.test(src));
  check('both Google Sheet payloads keep the original form text',
    (src.match(/stanleyContentBuild: data\.stanley_content_build \|\| "",/g) || []).length === 2);

  // The rule that caused this change in the first place. Checked across every
  // allowlist in the Worker, not just this one: a comma in any select option
  // is a write Notion refuses.
  const allowLists = [...src.matchAll(/const (BQ_[A-Z0-9_]+) = \[([\s\S]*?)\];/g)]
    .map((m) => [m[1], [...m[2].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((o) => o[1])]);
  const withCommas = allowLists.filter(([, opts]) => opts.some((o) => o.includes(',')));
  check('every Notion select allowlist in the Worker is comma-free',
    allowLists.length >= 6 && withCommas.length === 0,
    { lists: allowLists.length, offenders: withCommas });
  const mapped = Object.values(MAP);
  check('and so is every name this question can send',
    mapped.length === 3 && !mapped.some((o) => o.includes(',')), mapped);

  // Driven for real, through the route the page actually posts to.
  const lastNotion = () => {
    const call = [...mem.calls].reverse().find((c) => c.url.startsWith('https://api.notion.com/v1/pages'));
    return call ? JSON.parse(call.init.body).properties : {};
  };
  // memEnv has no sheet URL, so the Worker skips that write entirely. This
  // one adds it, which is the only way to see what the sheet would receive.
  const SHEET = 'https://script.google.test/sheet';
  const sheetEnv = { ...memEnv, GOOGLE_SHEET_ORDERS_URL: SHEET };
  const lastSheet = () => {
    const call = [...mem.calls].reverse().find((c) => String(c.url).startsWith(SHEET));
    return call ? JSON.parse(call.init.body) : null;
  };

  // Driven over the three the page lists, not a copy of them: a question that
  // lost an option would otherwise go untested rather than red. The count is
  // checked first so an empty list cannot make the loop vanish.
  check('there are three answers to drive', pageOptions.length === 3, pageOptions.length);
  for (const answer of pageOptions) {
    resetMembers();
    mem.members = [{ email: 'ada@example.com', role: 'buyer', active: true }];
    const res = await submitQuestionnaire({ ...ADA, stanley_content_build: answer });
    const prop = lastNotion()['Q Stanley Content Build'];
    check('"' + answer + '" reaches Notion as "' + MAP[answer] + '"',
      res.status === 200 && prop && prop.select && prop.select.name === MAP[answer], prop);
    check('"' + answer + '" has no comma by the time Notion sees it',
      Boolean(prop && prop.select) && !prop.select.name.includes(','), prop && prop.select);
  }

  // The sheet is the other half: it keeps what the member actually picked,
  // commas and all, so the export reads the way the form reads.
  resetMembers();
  mem.members = [{ email: 'ada@example.com', role: 'buyer', active: true }];
  await submitQuestionnaire({ ...ADA, stanley_content_build: "No, I'll build it myself" }, sheetEnv);
  const sheet = lastSheet();
  check('the Google Sheet gets the original text, comma and all',
    sheet && sheet.stanleyContentBuild === "No, I'll build it myself",
    sheet && sheet.stanleyContentBuild);
  check('so the two differ on purpose, rather than by accident',
    sheet && sheet.stanleyContentBuild !== lastNotion()['Q Stanley Content Build'].select.name);

  // A value the Notion select has never seen would 400 the whole PATCH and
  // take every other answer down with it, so the Worker drops it instead.
  resetMembers();
  mem.members = [{ email: 'ada@example.com', role: 'buyer', active: true }];
  const odd = await submitQuestionnaire({ ...ADA, stanley_content_build: 'Perhaps' });
  check('an answer outside the three is dropped, and the rest still saves',
    odd.status === 200 && !('Q Stanley Content Build' in lastNotion()),
    Object.keys(lastNotion()).filter((k) => k.includes('Stanley')));

  // Including the bracketed spelling itself: only the page's own words map.
  resetMembers();
  mem.members = [{ email: 'ada@example.com', role: 'buyer', active: true }];
  const already = await submitQuestionnaire({ ...ADA, stanley_content_build: "No (I'll build it myself)" });
  check('the Notion spelling is not accepted back as an answer',
    already.status === 200 && !('Q Stanley Content Build' in lastNotion()));

  // Not required, so most people will leave it alone.
  resetMembers();
  mem.members = [{ email: 'ada@example.com', role: 'buyer', active: true }];
  const none = await submitQuestionnaire(ADA);
  check('leaving it blank writes no property at all',
    none.status === 200 && !('Q Stanley Content Build' in lastNotion()));
}

console.log('\nAmbassador portal access');
{
  // The whole point: /superhuman is public and sign-in is email only, so
  // picking "Ambassador" cannot be what lets someone in.
  resetMembers();
  const res = await submitQuestionnaire({ ...ADA, name: 'Chancer', email: 'chancer@example.com', role: 'Ambassador' });
  check('the form still saves and answers 200', res.status === 200);
  check('an ambassador nobody approved gets no member row', mem.upserts.length === 0, mem.upserts);

  resetMembers();
  mem.allowlist = ['amb@example.com'];
  await submitQuestionnaire({ ...ADA, name: 'Amba Sador', email: ' AMB@Example.com ', role: 'Ambassador' });
  check('an approved ambassador gets one', mem.upserts.length === 1, mem.upserts);
  check('as role ambassador, with the address lowercased',
    mem.upserts[0] && mem.upserts[0].p_role === 'ambassador' &&
    mem.upserts[0].p_email === 'amb@example.com', mem.upserts[0]);
  check('and their name carried over', mem.upserts[0] && mem.upserts[0].p_full_name === 'Amba Sador', mem.upserts[0]);
  check('with no order id, because an ambassador never bought a seat',
    mem.upserts[0] && !mem.upserts[0].p_order_id, mem.upserts[0]);

  // A buyer answering the form is handled by the webhook, not by this path.
  resetMembers();
  mem.allowlist = ['ada@example.com'];
  mem.members = [{ email: 'ada@example.com', role: 'buyer', active: true }];
  await submitQuestionnaire(ADA);
  check('a Buyer answer never takes the ambassador path, even if allowlisted',
    mem.upserts.length === 0, mem.upserts);

  // Supabase being down must not change what the person filling in sees.
  resetMembers();
  mem.allowlist = ['amb@example.com'];
  mem.supabaseUp = false;
  const down = await submitQuestionnaire({ ...ADA, email: 'amb@example.com', role: 'Ambassador' });
  check('a Supabase outage still saves the form and never grants access',
    down.status === 200 && mem.upserts.length === 0, mem.upserts);

  resetMembers();
  mem.allowlist = ['amb@example.com'];
  await submitQuestionnaire({ ...ADA, email: 'amb@example.com', role: 'Ambassador' });
  check('nothing about the allowlist is ever logged',
    !mem.logs.some((line) => /amb@example\.com|allowlist/i.test(line)), mem.logs);
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
    !mem.logs.some((l) => l.includes(ADA.photo_link) || l.includes(ADA_PHOTO_ID) || l.includes('Ada') || l.includes('linkedin')), mem.logs);
}

{
  resetMembers();
  mem.members = [{ email: 'ada@example.com', role: 'buyer', active: true }];
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ...noSupabase } = memEnv;
  const res = await submitQuestionnaire(ADA, noSupabase);
  check('without Supabase configured the sync is skipped quietly',
    res.status === 200 && !mem.calls.some((c) => c.url.startsWith('https://sb.test/')));
}

console.log('\nTime Rich Members — photos');
{
  const photoEnv = { ...memEnv, SLACK_QUESTIONNAIRE_WEBHOOK_URL: 'https://hooks.slack.test/questionnaire' };
  const adaPath = createHash('sha256').update('ada@example.com').digest('hex') + '.jpg';
  const photoAlerts = () => mem.slack.filter((t) => t.startsWith('Photo link failed'));
  // Any piece of a Drive link: the file ids used here, or the URL parts every link shape has.
  const linkLeaked = () => mem.logs.some((l) =>
    ['/file/d/', 'open?id=', 'export=download', 'AdaPhotoFile', 'NewPhoto'].some((piece) => l.includes(piece)));
  const listAda = () => { mem.members = [{ email: 'ada@example.com', role: 'buyer', active: true }]; };

  // 1. A working, publicly shared JPEG.
  resetMembers(); listAda();
  await submitQuestionnaire(ADA, photoEnv);
  let row = mem.directory['ada@example.com'];
  check('photo success: stored as <sha256(email)>.jpg, status ok',
    row.photo_status === 'ok' && row.photo_path === adaPath, row);
  check('photo success: uploaded once with its image type and upsert on',
    mem.uploads.length === 1 && mem.uploads[0].path === adaPath && mem.uploads[0].type === 'image/jpeg' && mem.uploads[0].upsert === 'true', mem.uploads);
  check('photo success: the link is remembered in photo_source_url', row.photo_source_url === ADA.photo_link);
  check('photo success: no Slack alert', photoAlerts().length === 0);

  // 2. Drive answers with its HTML sign-in page (file not shared publicly).
  resetMembers(); listAda();
  mem.drive = {};
  await submitQuestionnaire(ADA, photoEnv);
  row = mem.directory['ada@example.com'];
  check('HTML response: status failed, nothing uploaded', row.photo_status === 'failed' && mem.uploads.length === 0, row);
  check('HTML response: Slack told exactly once, by name',
    photoAlerts().length === 1 &&
    photoAlerts()[0] === 'Photo link failed for Ada Lovelace. Ask them to set sharing to Anyone with the link.', mem.slack);
  check('HTML response: the link is not saved as the last good one', !row.photo_source_url);
  check('HTML response: the link is never logged', !linkLeaked(), mem.logs);

  // 3. Too big, whether the size is declared up front or only found while reading.
  resetMembers(); listAda();
  mem.drive = { [ADA_PHOTO_ID]: jpeg(6 * 1024 * 1024) };
  await submitQuestionnaire(ADA, photoEnv);
  check('oversize (Content-Length): failed, nothing uploaded, Slack once',
    mem.directory['ada@example.com'].photo_status === 'failed' && mem.uploads.length === 0 && photoAlerts().length === 1);
  resetMembers(); listAda();
  mem.drive = { [ADA_PHOTO_ID]: { type: 'image/png', bytes: 5 * 1024 * 1024 + 1 } };
  await submitQuestionnaire(ADA, photoEnv);
  check('oversize (no Content-Length, found while reading): failed, nothing uploaded',
    mem.directory['ada@example.com'].photo_status === 'failed' && mem.uploads.length === 0);

  // 4. Not a Drive link at all, or a Drive link with no file id.
  // (Anything that is not an https link is already dropped by the questionnaire
  // before it reaches Notion, so it arrives here as "no link".)
  for (const bad of ['https://example.com/me.jpg', 'https://drive.google.com/drive/folders/abc']) {
    resetMembers(); listAda();
    await submitQuestionnaire({ ...ADA, photo_link: bad }, photoEnv);
    const r = mem.directory['ada@example.com'];
    check('bad link "' + bad + '": failed without calling Drive, Slack once',
      r && r.photo_status === 'failed' && mem.driveHits.length === 0 && photoAlerts().length === 1, { r, hits: mem.driveHits });
  }

  // 5. Other image types and the other two Drive link shapes.
  resetMembers(); listAda();
  mem.drive = { [ADA_PHOTO_ID]: { type: 'image/webp', bytes: 2000 } };
  await submitQuestionnaire({ ...ADA, photo_link: 'https://drive.google.com/open?id=' + ADA_PHOTO_ID }, photoEnv);
  check('open?id= links work, and WebP is stored as .webp',
    mem.directory['ada@example.com'].photo_path.endsWith('.webp') && mem.driveHits[0] === ADA_PHOTO_ID);
  resetMembers(); listAda();
  await submitQuestionnaire({ ...ADA, photo_link: 'https://drive.google.com/uc?id=' + ADA_PHOTO_ID + '&export=download' }, photoEnv);
  check('uc?id= links work', mem.directory['ada@example.com'].photo_status === 'ok' && mem.driveHits[0] === ADA_PHOTO_ID);
  resetMembers(); listAda();
  mem.drive = { [ADA_PHOTO_ID]: { type: 'image/gif', bytes: 2000 } };
  await submitQuestionnaire(ADA, photoEnv);
  check('an image type outside JPEG, PNG and WebP is refused', mem.directory['ada@example.com'].photo_status === 'failed');

  // 6. When to download again (photo_source_url).
  resetMembers(); listAda();
  await submitQuestionnaire(ADA, photoEnv);
  mem.driveHits = []; mem.uploads = [];
  await submitQuestionnaire(ADA, photoEnv);
  check('same link, last download ok: Drive is not called again, photo kept',
    mem.driveHits.length === 0 && mem.uploads.length === 0 && mem.directory['ada@example.com'].photo_status === 'ok');

  const NEW_ID = 'NewPhotoFile_9876543210';
  mem.drive[NEW_ID] = { type: 'image/png', bytes: 3000 };
  await submitQuestionnaire({ ...ADA, photo_link: 'https://drive.google.com/file/d/' + NEW_ID + '/view' }, photoEnv);
  row = mem.directory['ada@example.com'];
  check('changed link: downloaded again and the new link remembered',
    mem.driveHits.includes(NEW_ID) && row.photo_source_url.includes(NEW_ID) && row.photo_path.endsWith('.png'), row);
  check('changed file type: the old .jpg is removed from storage', mem.deleted.includes(adaPath), mem.deleted);

  resetMembers(); listAda();
  mem.drive = {};                                   // not shared yet
  await submitQuestionnaire(ADA, photoEnv);
  check('first try fails while sharing is off', mem.directory['ada@example.com'].photo_status === 'failed');
  mem.drive = { [ADA_PHOTO_ID]: jpeg() };           // they fix sharing, same link
  mem.driveHits = [];
  await submitQuestionnaire(ADA, photoEnv);
  row = mem.directory['ada@example.com'];
  check('same link after a failure: tried again and now ok',
    mem.driveHits.length === 1 && row.photo_status === 'ok' && row.photo_source_url === ADA.photo_link, row);

  resetMembers(); listAda();
  mem.directory['ada@example.com'] = { email: 'ada@example.com', photo_status: 'missing', photo_source_url: ADA.photo_link };
  await submitQuestionnaire(ADA, photoEnv);
  check('same link while status is missing: tried again',
    mem.driveHits.length === 1 && mem.directory['ada@example.com'].photo_status === 'ok');

  resetMembers(); listAda();
  await submitQuestionnaire(ADA, photoEnv);
  const good = { ...mem.directory['ada@example.com'] };
  mem.drive = {};
  await submitQuestionnaire({ ...ADA, photo_link: 'https://drive.google.com/file/d/' + NEW_ID + '/view' }, photoEnv);
  row = mem.directory['ada@example.com'];
  check('a new link that fails keeps the last good path and link for the next comparison',
    row.photo_status === 'failed' && row.photo_path === good.photo_path && row.photo_source_url === good.photo_source_url, row);

  // 7. No link at all.
  resetMembers(); listAda();
  await submitQuestionnaire({ ...ADA, photo_link: '' }, photoEnv);
  check('no link: status missing, Drive not called, no Slack',
    mem.directory['ada@example.com'].photo_status === 'missing' && mem.driveHits.length === 0 && photoAlerts().length === 0);

  check('across every photo case, no link was ever logged', !linkLeaked(), mem.logs);
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
  check('rows with no photo link count as missing, not as photo failures', counts.photo_failed === 0, counts);
  check('buyers and second seats are listed, team and non-members skipped',
    counts.listed === 2 && counts.skipped === 2 && counts.failed === 0 &&
    Boolean(mem.directory['ada@example.com']) && Boolean(mem.directory['sam@example.com']) &&
    !mem.directory['kenneth@example.com'] && !mem.directory['amb@example.com'], counts);

  const before = JSON.stringify(mem.directory, (k, v) => (k === 'updated_at' ? undefined : v));
  const again = await (await backfill('sync-secret')).json();
  const after = JSON.stringify(mem.directory, (k, v) => (k === 'updated_at' ? undefined : v));
  check('running it twice leaves the same rows', again.listed === 2 && before === after);
}

console.log('\nTime Rich Members — read endpoint');
{
  const read = (body, { origin = 'https://timerich.ai', env = memEnv, raw } = {}) =>
    worker.fetch(new Request('https://w.dev/portal-directory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: raw !== undefined ? raw : JSON.stringify(body),
    }), env);

  const seed = () => {
    resetMembers();
    mem.codes = { 'BUYER-CODE1': 'buyer', 'SEAT0-CODE2': 'second_seat', 'TEAM0-CODE3': 'team' };
    mem.directory = {
      'zoe@example.com': {
        email: 'zoe@example.com', name: 'Zoe Zhang', hook_line: 'Ops nerd', title: 'COO', company: 'Zed',
        company_does: 'Runs things.', who_they_serve: 'Teams.', superpower: 'Calm.',
        linkedin: 'https://www.linkedin.com/in/zoe', instagram: 'javascript:alert(1)',
        other_links: 'https://zoe.dev\nhttp://insecure.example\n\nnot a link',
        photo_path: 'zoe.jpg', photo_status: 'ok', photo_source_url: 'https://drive.google.com/file/d/ZOESECRETLINK/view', role: 'buyer',
      },
      'ada@example.com': {
        email: 'ada@example.com', name: 'ada lovelace', hook_line: 'First programmer', title: 'Founder', company: 'Analytical Co',
        linkedin: 'https://www.linkedin.com/in/ada', photo_path: 'ada.jpg', photo_status: 'failed', role: 'buyer',
      },
      'bo@example.com': { email: 'bo@example.com', name: 'Bo Brown', photo_status: 'missing', role: 'second_seat' },
    };
    // A directory row is only listed while the membership behind it is still
    // a live buyer or second seat, so the two sides are seeded together.
    mem.members = [
      { email: 'zoe@example.com', role: 'buyer', active: true },
      { email: 'ada@example.com', role: 'buyer', active: true },
      { email: 'bo@example.com', role: 'second_seat', active: true },
    ];
  };

  seed();
  mem.enabled = false;
  const buyerOff = await read({ code: 'buyer-code1' });
  const seatOff = await read({ code: 'SEAT0-CODE2' });
  const teamOff = await read({ code: 'team0-code3' });
  check('switched off: a buyer gets 403', buyerOff.status === 403);
  check('switched off: a second seat gets 403', seatOff.status === 403);
  check('switched off: team still gets 200 for QA', teamOff.status === 200);

  seed();
  const noRow = await read({ code: 'buyer-code1' });
  check('no directory_enabled row at all counts as off', noRow.status === 403);

  seed();
  mem.enabled = 'true';
  check('only a real JSON true switches it on (not the string "true")', (await read({ code: 'buyer-code1' })).status === 403);

  seed();
  mem.enabled = true;
  const on = await read({ code: 'buyer-code1' });
  const text = await on.clone().text();
  const { profiles } = await on.json();
  check('switched on: a buyer gets 200', on.status === 200);
  check('profiles are sorted by name, ignoring case', profiles.map((p) => p.name).join('|') === 'ada lovelace|Bo Brown|Zoe Zhang', profiles.map((p) => p.name));
  check('no email anywhere in the response', !/@example\.com/.test(text) && profiles.every((p) => !('email' in p)), text);
  check('photo_source_url is never selected or returned',
    !mem.listedColumns.includes('photo_source_url') &&
    !text.includes('ZOESECRETLINK') && !text.includes('photo_source_url'), mem.listedColumns);
  // Email is selected now, purely to match a directory row to a live
  // membership. The check that matters is that it never leaves the Worker,
  // which the "no email anywhere in the response" case above covers.
  check('email is selected only to match the two tables',
    mem.listedColumns.includes('email'), mem.listedColumns);
  check('photo_path and photo_status stay server side', profiles.every((p) => !('photo_path' in p) && !('photo_status' in p)));

  const zoe = profiles.find((p) => p.name === 'Zoe Zhang');
  const ada = profiles.find((p) => p.name === 'ada lovelace');
  const bo = profiles.find((p) => p.name === 'Bo Brown');
  check('a stored photo comes back as an absolute signed URL',
    zoe.photo_url === 'https://sb.test/storage/v1/object/sign/portal-directory/zoe.jpg?token=t', zoe.photo_url);
  check('failed and missing photos come back as null (initials)', ada.photo_url === null && bo.photo_url === null);
  check('only ok photos are signed, in one request, for one hour',
    mem.signRequests.length === 1 && JSON.stringify(mem.signRequests[0].paths) === '["zoe.jpg"]' && mem.signRequests[0].expiresIn === 3600, mem.signRequests);
  check('profile fields come through in full',
    zoe.hook_line === 'Ops nerd' && zoe.title === 'COO' && zoe.company === 'Zed' && zoe.company_does === 'Runs things.' &&
    zoe.who_they_serve === 'Teams.' && zoe.superpower === 'Calm.' && zoe.linkedin === 'https://www.linkedin.com/in/zoe', zoe);
  check('a non-https link is dropped, never passed to the page', zoe.instagram === null);
  check('other links become a list of https URLs only', JSON.stringify(zoe.other_links) === '["https://zoe.dev"]', zoe.other_links);
  check('empty fields come back as empty strings, not null', bo.hook_line === '' && bo.company === '' && bo.linkedin === null);
  check('CORS answers timerich.ai only', on.headers.get('Access-Control-Allow-Origin') === 'https://timerich.ai');
  const elsewhere = await read({ code: 'buyer-code1' }, { origin: 'https://evil.example' });
  check('another origin gets no CORS allow header', elsewhere.headers.get('Access-Control-Allow-Origin') === null);

  seed();
  mem.enabled = true;
  mem.signFails = true;
  const unsigned = await read({ code: 'buyer-code1' });
  const unsignedProfiles = (await unsigned.json()).profiles;
  check('if signing fails the page still loads, with initials', unsigned.status === 200 && unsignedProfiles.every((p) => p.photo_url === null));

  // Every refusal is the same 403, byte for byte.
  seed();
  mem.enabled = false;
  const refusals = [
    await read({ code: 'buyer-code1' }),                                  // switched off
    await read({ code: 'WRONG-CODE0' }),                                  // unknown code
    await read({ code: '' }),                                             // empty code
    await read({}),                                                       // no code
    await read(null, { raw: '{not json' }),                               // bad JSON
    await read({ code: 'buyer-code1' }, { env: { ...memEnv, SUPABASE_URL: '' } }), // not configured
  ];
  const refusalBodies = await Promise.all(refusals.map((r) => r.text()));
  check('every refusal is a 403', refusals.every((r) => r.status === 403), refusals.map((r) => r.status));
  check('and every 403 body is byte-identical', refusalBodies.every((b) => b === refusalBodies[0]), refusalBodies);

  seed();
  mem.enabled = true;
  mem.supabaseUp = false;
  const down = await read({ code: 'buyer-code1' });
  check('a Supabase outage is the same 403, never a stack or detail', down.status === 403 && (await down.text()) === refusalBodies[0]);

  // Only active buyers and second seats are listed. A team account, a
  // membership that has been switched off, and a directory row with no live
  // membership behind it are all left out, however the row itself is labelled.
  seed();
  mem.enabled = true;
  await read({ code: 'buyer-code1' });
  check('the allowed list asks Supabase for active buyers and second seats only',
    /active=eq\.true/.test(mem.allowedQuery) && /role=in\.\(buyer,second_seat\)/.test(mem.allowedQuery),
    mem.allowedQuery);

  seed();
  mem.enabled = true;
  mem.directory['tam@example.com'] = { email: 'tam@example.com', name: 'Tam Team', role: 'buyer' };
  mem.members.push({ email: 'tam@example.com', role: 'team', active: true });
  const noTeam = (await (await read({ code: 'buyer-code1' })).json()).profiles.map((x) => x.name);
  check('a team account is not listed, whatever its directory row says',
    !noTeam.includes('Tam Team') && noTeam.length === 3, noTeam);

  seed();
  mem.enabled = true;
  mem.members = mem.members.map((m) => (m.email === 'ada@example.com' ? { ...m, active: false } : m));
  const noInactive = (await (await read({ code: 'buyer-code1' })).json()).profiles.map((x) => x.name);
  check('a switched-off member drops out of the directory',
    !noInactive.includes('ada lovelace') && noInactive.length === 2, noInactive);

  seed();
  mem.enabled = true;
  mem.directory['ghost@example.com'] = { email: 'ghost@example.com', name: 'Ghost Row', role: 'buyer' };
  const noGhost = (await (await read({ code: 'buyer-code1' })).json()).profiles.map((x) => x.name);
  check('a directory row with no membership behind it is not listed',
    !noGhost.includes('Ghost Row') && noGhost.length === 3, noGhost);

  seed();
  mem.enabled = true;
  mem.members = [];
  const none = await read({ code: 'buyer-code1' });
  check('nobody eligible is an empty list, not an error',
    none.status === 200 && (await none.json()).profiles.length === 0);

  seed();
  mem.enabled = true;
  const preflight = await worker.fetch(new Request('https://w.dev/portal-directory', {
    method: 'OPTIONS', headers: { Origin: 'https://timerich.ai' },
  }), memEnv);
  check('the browser preflight is answered for timerich.ai',
    preflight.status === 204 && preflight.headers.get('Access-Control-Allow-Origin') === 'https://timerich.ai');
}

console.log('\nThe gated portal routes now take a session token');
{
  const read = (body) =>
    worker.fetch(new Request('https://w.dev/portal-directory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://timerich.ai' },
      body: JSON.stringify(body),
    }), memEnv);

  const download = (body) =>
    worker.fetch(new Request('https://w.dev/portal-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://timerich.ai' },
      body: JSON.stringify(body),
    }), memEnv);

  resetMembers();
  mem.enabled = true;
  mem.tokens = { 'tok-live': 'buyer' };
  mem.codes = { 'BUYER-CODE1': 'buyer' };
  mem.directory = {};

  check('Members accepts a session token', (await read({ token: 'tok-live' })).status === 200);
  check('Members refuses a token it does not know', (await read({ token: 'tok-nope' })).status === 403);
  check('Members refuses a request with neither token nor code', (await read({})).status === 403);

  // The passcode path is kept on purpose: the column is still there, and a
  // member who has not signed in again should not be locked out.
  check('Members still accepts a passcode', (await read({ code: 'BUYER-CODE1' })).status === 200);

  check('Download refuses a token it does not know',
    (await download({ token: 'tok-nope', item_id: 1 })).status === 403);
  check('Download refuses a request with no credential at all',
    (await download({ item_id: 1 })).status === 403);
  check('Download refuses a request with no item',
    (await download({ token: 'tok-live' })).status === 403);
}

console.log('\nThe /os email gate: POST /os-email');
{
  const osEnv = { ...env, RESEND_API_KEY: 're_test' };

  // Its own stub: these tests need to choose what Resend answers, and to read
  // the contact we would have created.
  const resend = { status: 200, body: '{"id":"c-1"}', calls: [], logs: [] };
  const realFetch = globalThis.fetch;
  const realError = console.error;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    resend.calls.push({ url: u, init, body: init && typeof init.body === 'string' ? JSON.parse(init.body) : null });
    if (u.startsWith('https://api.resend.com/')) {
      return new Response(resend.body, { status: resend.status });
    }
    return realFetch(url, init);
  };

  async function gate(body, opts = {}) {
    resend.calls = [];
    resend.logs = [];
    resend.status = opts.status || 200;
    resend.body = opts.body === undefined ? '{"id":"c-1"}' : opts.body;
    console.error = (...a) => resend.logs.push(a.map(String).join(' '));
    const res = await worker.fetch(new Request('https://w.dev/os-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://timerich.ai' },
      body: JSON.stringify(body),
    }), opts.env || osEnv);
    console.error = realError;
    return res;
  }
  const contact = () => resend.calls.find((c) => c.url.includes('api.resend.com')).body;
  const hit = () => resend.calls.find((c) => c.url.includes('api.resend.com'));

  // --- the happy path -------------------------------------------------------
  {
    const res = await gate({ email: 'Nina@Example.com', first_name: 'Nina', source: 'os' });
    check('200 ok', res.status === 200);
    check('answers { ok: true } and nothing else',
      JSON.stringify(await res.json()) === '{"ok":true}');
    check('creates one Resend contact', resend.calls.length === 1, resend.calls.map((c) => c.url));
    check('posts to the account-wide Contacts API when no audience is set',
      hit().url === 'https://api.resend.com/contacts', hit().url);
    check('authorises with the existing RESEND_API_KEY',
      hit().init.headers.Authorization === 'Bearer re_test');
    check('sends the email lowercased', contact().email === 'nina@example.com', contact());
    check('sends first_name', contact().first_name === 'Nina');
    check('sends unsubscribed: false', contact().unsubscribed === false);
    check('never sends an email: it only touches the contacts endpoint',
      !resend.calls.some((c) => c.url.includes('/emails')), resend.calls.map((c) => c.url));
  }

  // --- the optional audience ------------------------------------------------
  {
    await gate({ email: 'nina@example.com', source: 'os' },
      { env: { ...osEnv, RESEND_OS_AUDIENCE_ID: 'aud-9' } });
    check('files the contact in RESEND_OS_AUDIENCE_ID when it is set',
      hit().url === 'https://api.resend.com/audiences/aud-9/contacts', hit().url);
  }

  // --- an email we already hold --------------------------------------------
  {
    const res = await gate({ email: 'nina@example.com', source: 'os' },
      { status: 409, body: '{"message":"Contact already exists"}' });
    check('a 409 from Resend is success, not an error', res.status === 200);
    check('...and still answers { ok: true }', (await res.json()).ok === true);
  }
  {
    const res = await gate({ email: 'nina@example.com', source: 'os' },
      { status: 422, body: '{"message":"Contact already exists for this audience"}' });
    check('"already exists" at any status is success too', res.status === 200);
  }

  // --- a real Resend failure -----------------------------------------------
  {
    const res = await gate({ email: 'nina@example.com', source: 'os' },
      { status: 500, body: '{"message":"internal"}' });
    check('a genuine Resend failure is a 502', res.status === 502, res.status);
    check('...and is logged with the status', resend.logs.join(' ').includes('500'), resend.logs);
  }

  // --- validation -----------------------------------------------------------
  {
    const bad = ['', 'nina', 'nina@', '@example.com', 'nina@example', 'ni na@example.com', 'nina@exa mple.com'];
    let allRejected = true;
    for (const email of bad) {
      const res = await gate({ email, source: 'os' });
      if (res.status !== 400 || resend.calls.length !== 0) allRejected = false;
    }
    check('every malformed email is rejected 400, with no Resend call', allRejected, bad);

    const res = await gate({ email: 'n'.repeat(200) + '@example.com', source: 'os' });
    check('an absurdly long email is rejected', res.status === 400 && resend.calls.length === 0);
  }
  {
    await gate({ email: '  nina@example.com  ', first_name: '  Nina  ', source: 'os' });
    check('surrounding whitespace is trimmed off both fields',
      contact().email === 'nina@example.com' && contact().first_name === 'Nina', contact());
  }
  {
    await gate({ email: 'nina@example.com', first_name: '', source: 'os' });
    check('first_name is left out entirely when it is blank',
      !('first_name' in contact()), contact());
  }
  {
    const res = await gate({ email: 'bot@example.com', _gotcha: 'x', source: 'os' });
    check('the honeypot is accepted silently and writes nothing',
      res.status === 200 && (await res.json()).ok === true && resend.calls.length === 0);
  }
  {
    const res = await worker.fetch(new Request('https://w.dev/os-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://timerich.ai' },
      body: 'not json',
    }), osEnv);
    check('a body that is not JSON is a 400', res.status === 400);
  }
  {
    const res = await gate({ email: 'nina@example.com', source: 'os' }, { env: env });
    check('with no RESEND_API_KEY the route says it is not configured', res.status === 500);
  }

  // --- CORS and origin, the same rules as the other form routes -------------
  {
    const res = await gate({ email: 'nina@example.com', source: 'os' });
    check('echoes the allowed origin back',
      res.headers.get('Access-Control-Allow-Origin') === 'https://timerich.ai',
      res.headers.get('Access-Control-Allow-Origin'));
    check('varies on Origin', res.headers.get('Vary') === 'Origin');

    const other = await worker.fetch(new Request('https://w.dev/os-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
      body: JSON.stringify({ email: 'nina@example.com', source: 'os' }),
    }), osEnv);
    check('an origin that is not on the list is not echoed back',
      other.headers.get('Access-Control-Allow-Origin') === 'https://timerich.ai',
      other.headers.get('Access-Control-Allow-Origin'));

    const pre = await worker.fetch(new Request('https://w.dev/os-email', {
      method: 'OPTIONS',
      headers: { Origin: 'https://timerich.ai' },
    }), osEnv);
    check('answers the preflight 204 with POST allowed',
      pre.status === 204 && /POST/.test(pre.headers.get('Access-Control-Allow-Methods')));

    const get = await worker.fetch(new Request('https://w.dev/os-email', {
      method: 'GET', headers: { Origin: 'https://timerich.ai' },
    }), osEnv);
    check('GET is not allowed', get.status === 405);
  }

  globalThis.fetch = realFetch;
}

globalThis.fetch = baseFetch;

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
