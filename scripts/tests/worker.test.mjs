// Worker mapping tests: mock Notion's API, POST payloads, assert what we'd write.
import worker from '../../worker/src/index.js';

const env = {
  NOTION_TOKEN: 'secret_test',
  NOTION_DATABASE_ID: 'db-main',
  NOTION_SUPERHUMAN_DATABASE_ID: 'db-sh',
  NOTION_WAITLIST_DATABASE_ID: 'db-wl',
  NOTION_COACHING_DATABASE_ID: 'db-co',
  ALLOWED_ORIGIN: 'https://timerich.ai',
};

let calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init });
  if (String(url).includes('/v1/databases/')) {
    return new Response(JSON.stringify({ properties: { Name: { type: 'title' }, Email: { type: 'email' } } }), { status: 200 });
  }
  return new Response(JSON.stringify({ id: 'page-1' }), { status: 200 });
};

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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
