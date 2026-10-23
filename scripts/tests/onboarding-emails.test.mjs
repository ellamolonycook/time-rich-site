// The automatic onboarding emails: welcome now, prep two hours later.
//
// Both emails are handed to Resend in the same request. The prep one carries
// `scheduled_at` rather than waiting on a cron, so what this suite asserts is
// the pair of POSTs the Worker would make to https://api.resend.com/emails:
// who they go to, what is in them, and — more often — that they are not made
// at all.
//
// One fake stands in for Supabase, Notion and Resend. The Supabase reply is
// the real portal_upsert_member shape, {"ok":true,"id":...,"created":...},
// because `created` is the whole gate: a webhook retry, a repeat purchase and
// an existing member all come back created=false and must send nothing.
//
// Date.now() is stubbed per run. The copy changes at kickoff (Monday 26
// October 2026, 12pm ET = 16:00 UTC) and the prep email is built against its
// own send time, two hours out, so an order placed an hour before kickoff is
// the interesting case: pre-kickoff welcome, post-kickoff prep.
import worker from '../../worker/src/index.js';
import { JSDOM } from 'jsdom';

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

/* ---- the world the Worker runs in --------------------------------------- */

const SB_URL = 'https://sb.test';
const RESEND = 'https://api.resend.com/emails';

const ENV = {
  ALLOWED_ORIGIN: 'https://timerich.ai',
  THRIVECART_SECRET: 'tc-secret',
  NOTION_TOKEN: 'secret_test',
  NOTION_SUPERHUMAN_COHORT1_DATABASE_ID: 'db-cohort',
  SUPABASE_URL: SB_URL,
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test_key',
  RESEND_API_KEY: 're_test_key',
  ONBOARDING_FROM: 'Time Rich <hello@timerich.ai>',
  ONBOARDING_EMAILS_ENABLED: 'true',
};

// Kickoff, and three vantage points around it.
const KICKOFF = Date.UTC(2026, 9, 26, 16, 0, 0);
const HOUR = 60 * 60 * 1000;
const BEFORE = KICKOFF - 72 * HOUR;   // Friday 23 October, well before
const STRADDLE = KICKOFF - 1 * HOUR;  // welcome lands before, prep after
const AFTER = KICKOFF + 48 * HOUR;    // Wednesday 28 October

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

let sent, logs, created, resendStatus;

const fakeFetch = async (url, init) => {
  url = String(url);
  if (url === RESEND) {
    sent.push({ headers: init.headers, body: JSON.parse(init.body) });
    if (resendStatus && resendStatus !== 200) {
      return new Response(JSON.stringify({ message: 'nope' }), { status: resendStatus });
    }
    return new Response(JSON.stringify({ id: 'email-1' }), { status: 200 });
  }
  if (new URL(url).origin === new URL(SB_URL).origin) {
    return new Response(JSON.stringify({ ok: true, id: 'member-abc', created }), { status: 200 });
  }
  if (url.includes('/v1/databases/') && url.endsWith('/query')) {
    return new Response(JSON.stringify({ results: [PAID_ROW] }), { status: 200 });
  }
  return new Response(JSON.stringify({ id: 'page-1' }), { status: 200 });
};

const realLog = console.log, realErr = console.error, realNow = Date.now;

// One request, with the clock and the upsert's `created` flag pinned.
async function run(path, body, opts = {}) {
  sent = []; logs = [];
  created = opts.created !== false;
  resendStatus = opts.resendStatus || 200;
  globalThis.fetch = fakeFetch;
  Date.now = () => (opts.now === undefined ? BEFORE : opts.now);
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => logs.push(a.join(' '));
  const pending = [];
  try {
    const res = await worker.fetch(new Request('https://w.dev' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://timerich.ai' },
      body: JSON.stringify(body),
    }), { ...ENV, ...(opts.env || {}) }, { waitUntil: (p) => pending.push(p) });
    await Promise.all(pending);
    return res;
  } finally {
    console.log = realLog; console.error = realErr; Date.now = realNow;
  }
}

const TC = {
  event: 'order.success', mode: 'live', thrivecart_secret: 'tc-secret',
  order_id: 'TC-555', order_total: '99700',
  customer: { email: '  Buyer@Example.com ', first_name: 'Bea', last_name: 'Buyer' },
  passthrough: { tracking_id: 'trk-1' },
};
const ONB = {
  trackingId: 'trk-1', email: 'buyer@example.com', choice: 'named',
  attendeeFirstName: 'Pat', attendeeLastName: 'Plus', attendeeEmail: 'Pat.Plus@Example.com',
};

const onboardingLogs = () => logs.filter((l) => l.includes('onboarding:'));
const welcomeOf = (list) => list.find((e) => /Welcome to the Superhuman/.test(e.body.subject));
const prepOf = (list) => list.find((e) => /Preparation to Become/.test(e.body.subject));
const visible = (html) => new JSDOM(html).window.document.body.textContent.replace(/\s+/g, ' ').trim();
const hrefs = (html) => [...new JSDOM(html).window.document.querySelectorAll('a')]
  .map((a) => a.getAttribute('href'));

/* ---- a buyer, live and new ---------------------------------------------- */

console.log('\na live paid ThriveCart order from somebody new');
{
  const res = await run('/thrivecart-webhook', TC);
  check('ThriveCart still gets its 200', res.status === 200);
  check('two emails: the welcome and the prep', sent.length === 2,
    sent.map((e) => e.body.subject));

  const w = welcomeOf(sent), p = prepOf(sent);
  check('the welcome subject is Ella\'s', w && w.body.subject === "You're in! Welcome to the Superhuman Accelerator",
    w && w.body.subject);
  check('the prep subject is Ella\'s', p && p.body.subject === 'Preparation to Become Superhuman',
    p && p.body.subject);

  check('the welcome goes now: no scheduled_at', w && !('scheduled_at' in w.body), w && w.body.scheduled_at);
  check('the prep is scheduled two hours out',
    p && p.body.scheduled_at === new Date(BEFORE + 2 * HOUR).toISOString(),
    p && p.body.scheduled_at);
  check('and that is a real ISO 8601 instant',
    p && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(p.body.scheduled_at || ''),
    p && p.body.scheduled_at);

  check('both go to the buyer, lowercased and trimmed',
    sent.every((e) => Array.isArray(e.body.to) && e.body.to.length === 1 &&
      e.body.to[0] === 'buyer@example.com'), sent.map((e) => e.body.to));
  check('both come from ONBOARDING_FROM', sent.every((e) => e.body.from === ENV.ONBOARDING_FROM),
    sent.map((e) => e.body.from));
  check('both reply to emc@timerichclub.com',
    sent.every((e) => e.body.reply_to === 'emc@timerichclub.com'), sent.map((e) => e.body.reply_to));

  check('the idempotency keys are keyed on the member id',
    w && w.headers['Idempotency-Key'] === 'onboarding-welcome/member-abc' &&
    p && p.headers['Idempotency-Key'] === 'onboarding-prep/member-abc',
    sent.map((e) => e.headers['Idempotency-Key']));

  check('each one is HTML with a plain-text alternative',
    sent.every((e) => typeof e.body.html === 'string' && e.body.html.includes('<html') &&
      typeof e.body.text === 'string' && e.body.text.length > 200));

  check('the greeting uses the first word of the name',
    w && visible(w.body.html).startsWith('Hi Bea,') && w.body.text.startsWith('Hi Bea,'),
    w && visible(w.body.html).slice(0, 20));

  check('a buyer is told about their +1',
    w && visible(w.body.html).includes('Your seat includes a +1. Add them at timerich.ai/onboard'),
    w && visible(w.body.html).slice(0, 400));
  check('and is not told that they are one',
    w && !visible(w.body.html).includes("You've been added as a +1"));

  check('the welcome carries the three next steps',
    w && ['Add every live session to your calendar', 'onboarding questions', 'Log in to the Time Rich Club']
      .every((s) => visible(w.body.html).includes(s)));
  check('and what we ask members to commit to',
    w && visible(w.body.html).includes('tagging @timerichtalk') &&
    w && visible(w.body.html).includes('1 video testimonial and 1 recommendation'));

  check('the prep email carries all seven steps',
    p && ['Claude Pro or ChatGPT Plus', 'Install Wispr Flow', 'Connect your tools to your AI',
      'Record last week', 'Business COMPASS', 'Superhuman WhatsApp group', 'Time Rich Club Slack']
      .every((s) => visible(p.body.html).includes(s)));
  check('including the Wispr code', p && visible(p.body.html).includes('enter TIMERICH6'));

  // Scoped to this feature's own lines. The ThriveCart handler's existing
  // "[TC] branch: PAID" trace already prints the order's email and is not
  // something this change touches.
  check('nothing the onboarding step logs carries the member\'s address',
    !onboardingLogs().some((l) => l.toLowerCase().includes('buyer@example.com')),
    onboardingLogs());
  check('the log says what happened', logs.some((l) => /onboarding: welcome sent \| prep scheduled ok/.test(l)),
    logs.filter((l) => l.includes('onboarding')));
}

/* ---- a +1 through /onboard ---------------------------------------------- */

console.log('\na +1 added through timerich.ai/onboard');
{
  const res = await run('/onboard', ONB);
  check('the form still gets its 200', res.status === 200);
  check('two emails again', sent.length === 2, sent.map((e) => e.body.subject));

  const w = welcomeOf(sent), p = prepOf(sent);
  check('both go to the +1, not the buyer',
    sent.every((e) => e.body.to[0] === 'pat.plus@example.com'), sent.map((e) => e.body.to));
  check('greeted by their own first name', w && visible(w.body.html).startsWith('Hi Pat,'),
    w && visible(w.body.html).slice(0, 20));

  check('a +1 is told that they are one',
    w && visible(w.body.html).includes("You've been added as a +1, so your seat is ready."),
    w && visible(w.body.html).slice(0, 400));
  check('and gets that line instead of the buyer\'s, not as well',
    w && !visible(w.body.html).includes('Your seat includes a +1'));
  // The opening paragraph already says it, and Ella asked for it only once.
  check('"You\'re in!" is said once in the whole email',
    w && visible(w.body.html).split("You're in!").length - 1 === 1,
    w && visible(w.body.html).split("You're in!").length - 1);
  check('and once in the plain-text alternative too',
    w && w.body.text.split("You're in!").length - 1 === 1,
    w && w.body.text.split("You're in!").length - 1);

  check('the prep email is the same one buyers get',
    p && p.body.subject === 'Preparation to Become Superhuman' &&
    visible(p.body.html).includes('Business COMPASS'));
  check('still keyed on the member id',
    w && w.headers['Idempotency-Key'] === 'onboarding-welcome/member-abc');
}

/* ---- everybody who must not get them ------------------------------------ */

console.log('\nwho does not get them');
{
  let res = await run('/thrivecart-webhook', TC, { created: false });
  check('an existing member: upsert said created=false, nothing sent',
    res.status === 200 && sent.length === 0, sent.map((e) => e.body.subject));

  res = await run('/onboard', ONB, { created: false });
  check('a +1 who is already a member: nothing sent', res.status === 200 && sent.length === 0);

  res = await run('/thrivecart-webhook', { ...TC, event: 'order.refund' });
  check('a refund: nothing sent', res.status === 200 && sent.length === 0);

  res = await run('/thrivecart-webhook', { ...TC, mode: 'test' });
  check('a test-mode order: nothing sent', res.status === 200 && sent.length === 0);

  res = await run('/thrivecart-webhook', { ...TC, mode: undefined });
  check('an order with no mode at all: nothing sent', res.status === 200 && sent.length === 0);

  res = await run('/thrivecart-webhook', { ...TC, thrivecart_secret: 'wrong' });
  check('a webhook with the wrong secret: 401, nothing sent',
    res.status === 401 && sent.length === 0);

  res = await run('/onboard', { ...ONB, choice: 'unsure' });
  check('a buyer who has not named their +1 yet: nothing sent',
    res.status === 200 && sent.length === 0);

  res = await run('/onboard', { ...ONB, attendeeEmail: ' BUYER@example.com' });
  check('a buyer who names themselves as the +1: nothing sent',
    res.status === 200 && sent.length === 0);
}

console.log('\nthe kill switch');
{
  let res = await run('/thrivecart-webhook', TC, { env: { ONBOARDING_EMAILS_ENABLED: undefined } });
  check('unset: nothing sent, and the order is still 200',
    res.status === 200 && sent.length === 0, sent.map((e) => e.body.subject));
  check('and the log says why', logs.some((l) => l.includes('ONBOARDING_EMAILS_ENABLED')),
    logs.filter((l) => l.includes('onboarding')));

  res = await run('/thrivecart-webhook', TC, { env: { ONBOARDING_EMAILS_ENABLED: 'false' } });
  check('"false": nothing sent', sent.length === 0);

  res = await run('/thrivecart-webhook', TC, { env: { ONBOARDING_EMAILS_ENABLED: 'TRUE' } });
  check('"TRUE": nothing sent, it has to be exactly "true"', sent.length === 0);

  res = await run('/thrivecart-webhook', TC, { env: { ONBOARDING_EMAILS_ENABLED: '1' } });
  check('"1": nothing sent', sent.length === 0);

  res = await run('/thrivecart-webhook', TC, { env: { ONBOARDING_EMAILS_ENABLED: 'true' } });
  check('"true": the pair goes out', sent.length === 2);
}

console.log('\nthe sender, and failures that must stay quiet');
{
  let res = await run('/thrivecart-webhook', TC, { env: { ONBOARDING_FROM: undefined, PORTAL_PASSCODE_FROM: 'Portal <portal@timerich.ai>' } });
  check('ONBOARDING_FROM unset falls back to PORTAL_PASSCODE_FROM',
    sent.length === 2 && sent.every((e) => e.body.from === 'Portal <portal@timerich.ai>'),
    sent.map((e) => e.body.from));

  res = await run('/thrivecart-webhook', TC, { env: { ONBOARDING_FROM: undefined, PORTAL_PASSCODE_FROM: undefined } });
  check('neither one set: nothing sent, order still 200', res.status === 200 && sent.length === 0);

  res = await run('/thrivecart-webhook', TC, { env: { RESEND_API_KEY: undefined } });
  check('no Resend key: nothing sent, order still 200', res.status === 200 && sent.length === 0);

  res = await run('/thrivecart-webhook', TC, { resendStatus: 500 });
  check('Resend 500: ThriveCart still gets its 200', res.status === 200);
  check('both were still attempted, so one failure does not cancel the other',
    sent.length === 2, sent.length);
  check('the failure is logged, without an address',
    onboardingLogs().some((l) => l.includes('onboarding: send failed')) &&
    !onboardingLogs().some((l) => l.toLowerCase().includes('buyer@example.com')),
    onboardingLogs());
}

/* ---- the copy before and after kickoff ---------------------------------- */

console.log('\nthe wording changes at kickoff');
{
  await run('/thrivecart-webhook', TC, { now: BEFORE });
  let w = welcomeOf(sent), p = prepOf(sent);
  check('before kickoff: the welcome says we kick off on Monday',
    w && visible(w.body.html).includes('We kick off on Monday 26 October at 12pm ET, and we’re live on Zoom every Monday and Friday at 12pm ET until Friday 20 November.'.replace(/’/g, "'")),
    w && visible(w.body.html).slice(0, 300));
  check('and does not mention recordings', w && !visible(w.body.html).includes('Catch up on the recordings'));
  check('before kickoff: both sign off "See you Monday!"',
    w && visible(w.body.html).includes('See you Monday!') &&
    p && visible(p.body.html).includes('See you Monday!'));
  check('before kickoff: the WhatsApp step keeps the Saturday sentence',
    p && visible(p.body.html).includes('We accept everyone on Saturday 24 October at 12pm ET.'));

  await run('/thrivecart-webhook', TC, { now: AFTER });
  w = welcomeOf(sent); p = prepOf(sent);
  check('after kickoff: the welcome says we kicked off',
    w && visible(w.body.html).includes('We kicked off on Monday 26 October, and we\'re live on Zoom every Monday and Friday at 12pm ET until Friday 20 November. Catch up on the recordings in the Time Rich Club.'),
    w && visible(w.body.html).slice(0, 320));
  check('and drops the old kick-off sentence', w && !visible(w.body.html).includes('We kick off on Monday'));
  check('after kickoff: both sign off "See you at the next session!"',
    w && visible(w.body.html).includes('See you at the next session!') &&
    p && visible(p.body.html).includes('See you at the next session!'));
  check('and neither still says "See you Monday!"',
    w && !visible(w.body.html).includes('See you Monday!') &&
    p && !visible(p.body.html).includes('See you Monday!'));
  check('after kickoff: the WhatsApp step drops the Saturday sentence',
    p && !visible(p.body.html).includes('Saturday 24 October'));
  check('but still says to join the group',
    p && visible(p.body.html).includes('Join the Superhuman WhatsApp group for announcements.'));

  // Each email is built against its own send time, not against "now".
  await run('/thrivecart-webhook', TC, { now: STRADDLE });
  w = welcomeOf(sent); p = prepOf(sent);
  check('an order an hour before kickoff: the welcome is still pre-kickoff',
    w && visible(w.body.html).includes('We kick off on Monday 26 October') &&
    visible(w.body.html).includes('See you Monday!'));
  check('...and the prep email, landing an hour after it, is post-kickoff',
    p && visible(p.body.html).includes('See you at the next session!') &&
    !visible(p.body.html).includes('Saturday 24 October'),
    p && visible(p.body.html).slice(-80));
}

/* ---- links -------------------------------------------------------------- */

console.log('\nevery link is hyperlinked text, and goes where Ella said');
{
  const ALLOWED = new Set([
    'https://timerich.ai/onboard/',
    'https://www.addevent.com/calendar/z0j4nlqbgt6b',
    'https://timerich.ai/superhuman/',
    'https://timerich.ai/portal/',
    'https://www.linkedin.com/in/ellamolonycook/',
    'https://ref.wisprflow.ai/ella-cook-vt27',
    'https://superhumanos.notion.site/Wispr-Flow-setup-Superhuman-Accelerator-401ca5ebe5578114bfc3d3bc73be21bd',
    'https://superhumanos.notion.site/Connect-your-tools-to-your-AI-Superhuman-Accelerator-401ca5ebe557817aaa44ff89de92a091',
    'https://docs.google.com/document/d/1c50ST_FSASEOCIh1z3GQhkdNl9eqFjY0asvk-MC1X5s/copy',
    'https://chat.whatsapp.com/E5GU1dvuHhFDI77yO88OIw?mode=gi_t',
    'https://join.slack.com/t/timerichclub/shared_invite/zt-4dry4ppfn-yV~VNRrHW_z3K3AFtbnOJQ',
  ]);

  // Both roles, both sides of kickoff: between them every conditional branch
  // of the copy is walked.
  const seen = new Set();
  for (const [path, body] of [['/thrivecart-webhook', TC], ['/onboard', ONB]]) {
    for (const now of [BEFORE, AFTER]) {
      await run(path, body, { now });
      check(`${path} @ ${now === BEFORE ? 'before' : 'after'}: two emails to inspect`, sent.length === 2);
      for (const email of sent) {
        const found = hrefs(email.body.html);
        check(`${path}/${email.body.subject.slice(0, 18)}: every href is one Ella gave us`,
          found.length > 0 && found.every((h) => ALLOWED.has(h)),
          found.filter((h) => !ALLOWED.has(h)));
        for (const h of found) seen.add(h);

        check(`${path}/${email.body.subject.slice(0, 18)}: no raw URL in what the member reads`,
          !/https?:\/\//.test(visible(email.body.html)),
          (visible(email.body.html).match(/https?:\/\/\S+/g) || []).slice(0, 3));

        check(`${path}/${email.body.subject.slice(0, 18)}: no empty link text`,
          [...new JSDOM(email.body.html).window.document.querySelectorAll('a')]
            .every((a) => a.textContent.trim().length > 1));

        // The plain-text alternative is the one place an address has to
        // appear, and every link in the HTML has to survive into it.
        check(`${path}/${email.body.subject.slice(0, 18)}: the text alternative carries the same links`,
          found.every((h) => email.body.text.includes(h)),
          found.filter((h) => !email.body.text.includes(h)));
      }
    }
  }

  check('between them the two emails use all eleven links',
    seen.size === ALLOWED.size, { used: seen.size, expected: ALLOWED.size });
}

/* ---- the name is somebody else's input ---------------------------------- */

console.log('\nthe name on the order is input, and is treated as such');
{
  await run('/thrivecart-webhook', {
    ...TC,
    customer: { ...TC.customer, first_name: '<script>x</script>', last_name: '' },
  });
  const w = welcomeOf(sent);
  check('a name with markup in it is escaped, not injected',
    w && !w.body.html.includes('<script>') && w.body.html.includes('&lt;script&gt;'),
    w && w.body.html.slice(w.body.html.indexOf('Hi '), w.body.html.indexOf('Hi ') + 60));

  await run('/thrivecart-webhook', {
    ...TC, customer: { email: 'buyer@example.com', first_name: '', last_name: '' }, name: '',
  });
  const w2 = welcomeOf(sent);
  check('no name on the order falls back to "Hi there,"',
    w2 && visible(w2.body.html).startsWith('Hi there,') && w2.body.text.startsWith('Hi there,'),
    w2 && visible(w2.body.html).slice(0, 20));
}

/* ---- a $0 coupon order is a real member --------------------------------- */

console.log('\na coupon order that comes to $0');
{
  const res = await run('/thrivecart-webhook', { ...TC, order_total: '0' });
  check('still a member, still both emails', res.status === 200 && sent.length === 2,
    sent.map((e) => e.body.subject));
}

globalThis.fetch = undefined;
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
