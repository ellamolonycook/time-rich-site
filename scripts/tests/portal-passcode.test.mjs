// Portal passcode email endpoint tests. Every network request is mocked: this
// suite never contacts Supabase or Resend and never sends an email.
import worker from '../../worker/src/index.js';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'supabase_service_role_test',
  RESEND_API_KEY: 'resend_secret_test',
  PORTAL_PASSCODE_ADMIN_TOKEN: 'admin_token_test',
  PORTAL_PASSCODE_FROM: 'Time Rich <portal@example.com>',
  PORTAL_PASSCODE_REPLY_TO: 'replies@example.com',
  PORTAL_PASSCODE_TEST_RECIPIENTS: 'team-one@example.com,team-two@example.com',
};

let calls = [];
let members = [
  { id: '11111111-1111-1111-1111-111111111111', full_name: 'Jordan Example', email: 'jordan@example.com', passcode: 'ABCDE-FGHIJ', role: 'buyer' },
  { id: '22222222-2222-2222-2222-222222222222', full_name: 'Sam Seat', email: 'sam@example.com', passcode: 'KLMNO-PQRST', role: 'second_seat' },
  { id: '33333333-3333-3333-3333-333333333333', full_name: 'Team Member', email: 'team@example.com', passcode: 'UVWXY-Z2345', role: 'team' },
];

globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  if (String(url).includes('/rest/v1/portal_members') && (!init.method || init.method === 'GET')) {
    return new Response(JSON.stringify(members), { status: 200 });
  }
  if (String(url).includes('/rest/v1/portal_members') && init.method === 'PATCH') {
    return new Response(JSON.stringify([{}]), { status: 200 });
  }
  if (String(url) === 'https://api.resend.com/emails') {
    return new Response(JSON.stringify({ id: 'email-1' }), { status: 200 });
  }
  throw new Error('Unexpected fetch ' + url);
};

function request(body, token = env.PORTAL_PASSCODE_ADMIN_TOKEN) {
  calls = [];
  return worker.fetch(new Request('https://worker.example/portal-passcode-emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }), env);
}

let pass = 0, fail = 0;
function check(name, condition, extra) {
  if (condition) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' -> ' + JSON.stringify(extra) : '')); }
}

console.log('\n/portal-passcode-emails — dry run');
{
  const resendKey = env.RESEND_API_KEY;
  delete env.RESEND_API_KEY;
  const response = await request({ mode: 'dry_run' });
  env.RESEND_API_KEY = resendKey;
  const body = await response.json();
  const combined = JSON.stringify(body);
  check('returns a dry-run response', response.status === 200 && body.mode === 'dry_run', body);
  check('does not call Resend', !calls.some((call) => call.url === 'https://api.resend.com/emails'), calls);
  check('does not write passcode_sent_at', !calls.some((call) => call.init.method === 'PATCH'), calls);
  check('does not require Resend configuration', response.status === 200, body);
  check('asks Supabase for buyers and second seats only', calls[0].url.includes('role=in.%28buyer%2Csecond_seat%29'), calls[0]);
  check('uses the shared Supabase service-role headers', calls[0].init.headers.apikey === env.SUPABASE_SERVICE_ROLE_KEY && calls[0].init.headers.Authorization === `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, calls[0]);
  check('defense in depth excludes team members', body.eligible === 2 && !combined.includes('Team Member'), body);
  check('masks the recipient email', combined.includes('j***@example.com') && !combined.includes('jordan@example.com'), body);
  // Signing in is the email address now. The email must carry no passcode
  // at all, and the preview must not show the member's real address.
  check('carries no passcode', !combined.includes('ABCDE-FGHIJ') && !combined.includes('KLMNO-PQRST') && !/passcode:/i.test(combined), body);
  check('tells the member to sign in with their email',
    combined.includes('sign in with this email address') && combined.includes('timerich.ai/portal'), body);
  check('uses no CORS response header', !response.headers.has('Access-Control-Allow-Origin'));
}

console.log('\n/portal-passcode-emails — authorization and confirmation');
{
  const unauthorized = await request({ mode: 'dry_run' }, 'wrong_token');
  check('rejects a wrong admin token', unauthorized.status === 401);

  const noConfirmation = await request({ mode: 'send', confirm: true });
  check('requires the exact send confirmation phrase', noConfirmation.status === 400);
  check('does not send when confirmation is wrong', !calls.some((call) => call.url === 'https://api.resend.com/emails'));
}

console.log('\n/portal-passcode-emails — confirmed send');
{
  const disabled = await request({ mode: 'send', confirm: 'SEND_PORTAL_PASSCODES' });
  check('hard-blocks buyer sends until the portal approval gate is enabled', disabled.status === 403);
  check('does not read Supabase or call Resend while buyer sends are blocked', calls.length === 0, calls);

  env.PORTAL_PASSCODE_BUYER_SEND_ENABLED = 'true';
  const response = await request({ mode: 'send', confirm: 'SEND_PORTAL_PASSCODES' });
  const body = await response.json();
  const resend = calls.find((call) => call.url === 'https://api.resend.com/emails');
  const patch = calls.find((call) => call.init.method === 'PATCH');
  check('sends eligible buyers and second seats after confirmation', response.status === 200 && body.sent === 2, body);
  check('uses an idempotency key', resend && resend.init.headers['Idempotency-Key'] === 'portal-passcode/11111111-1111-1111-1111-111111111111', resend);
  check('records sent timestamp after the email call', calls.indexOf(resend) < calls.indexOf(patch), calls);
  check('records sent timestamp with the shared Supabase service-role headers', patch && patch.init.headers.apikey === env.SUPABASE_SERVICE_ROLE_KEY && patch.init.headers.Authorization === `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, patch);
  const email = JSON.parse(resend.init.body);
  check('uses the approved portal link and support contact copy', email.text.includes('https://timerich.ai/portal') && email.text.includes('Questions? Reply to this email or write to emc@timerich.ai.') && email.text.includes('Warmly,\nElla\nFounder, Time Rich') && !email.text.includes('—'), email);
  check('send response does not expose the passcode', !JSON.stringify(body).includes('ABCDE-FGHIJ'), body);
  delete env.PORTAL_PASSCODE_BUYER_SEND_ENABLED;
}

console.log('\n/portal-passcode-emails — restricted real-email test mode');
{
  const invalid = await request({ mode: 'test_send', test_recipients: ['one@example.com', 'two@example.com', 'three@example.com'], confirm: 'SEND_PORTAL_PASSCODE_TEST' });
  check('rejects more than two test recipients', invalid.status === 400);

  const noConfirmation = await request({ mode: 'test_send', test_recipients: ['team-one@example.com'], confirm: 'wrong' });
  check('requires the separate test-send confirmation phrase', noConfirmation.status === 400);

  const unapproved = await request({ mode: 'test_send', test_recipients: ['outside@example.com'], confirm: 'SEND_PORTAL_PASSCODE_TEST' });
  check('rejects a test recipient outside the configured allowlist', unapproved.status === 400);
  check('does not send when a test recipient is not allowlisted', !calls.some((call) => call.url === 'https://api.resend.com/emails'));

  const response = await request({ mode: 'test_send', test_recipients: ['team-one@example.com', 'team-two@example.com'], confirm: 'SEND_PORTAL_PASSCODE_TEST' });
  const body = await response.json();
  const resendCalls = calls.filter((call) => call.url === 'https://api.resend.com/emails');
  const payloads = resendCalls.map((call) => JSON.parse(call.init.body));
  check('sends only the two explicitly supplied test addresses', response.status === 200 && body.sent === 2 && payloads.every((payload) => payload.to[0].startsWith('team-')), payloads);
  check('carries no member data and no passcode',
    payloads.every((payload) => !payload.text.includes('ABCDE-FGHIJ')
      && !payload.text.includes('jordan@example.com')
      && !/passcode:/i.test(payload.text)), payloads);
  check('uses the configured reply-to address', payloads.every((payload) => payload.reply_to === 'replies@example.com'), payloads);
  check('does not query or update Supabase in test mode', !calls.some((call) => call.url.includes('/rest/v1/portal_members')), calls);
  check('does not expose test addresses in the response', !JSON.stringify(body).includes('team-one@example.com'), body);
}

if (fail) {
  console.error(`\n${fail} portal passcode test(s) failed.`);
  process.exit(1);
}
console.log(`\n${pass} portal passcode test(s) passed.`);
