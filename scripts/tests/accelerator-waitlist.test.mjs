import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const HTML = read('accelerator/index.html');
const JOIN = read('join/index.html');

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  -> ' + JSON.stringify(x) : '')); } };

const posts = [];
const dom = new JSDOM(HTML, {
  url: 'https://timerich.ai/accelerator/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: new VirtualConsole(),
  beforeParse(w) {
    w.gtag = () => {};
    w.fetch = (url, init) => {
      posts.push({ url: String(url), body: JSON.parse(init.body) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
    };
  },
});
const w = dom.window, doc = w.document;
await new Promise((r) => setTimeout(r, 60));

console.log('\nthe page still loads and the waitlist replaced the checkout');
check('no price anywhere a visitor can read', !/\$1,297|under \$650|Payment plan/.test(HTML));
check('no checkout host and no ThriveCart script',
  !/checkout\.timerich\.ai/.test(HTML) &&
  !/THRIVECART_/.test(HTML) && !/thrivecart\.com/i.test(HTML) &&
  !/<script[^>]*thrivecart/i.test(HTML));
check('and a visitor reads no "checkout" anywhere',
  !/checkout/i.test(doc.body.textContent), (doc.body.textContent.match(/.{0,30}checkout.{0,30}/i) || [])[0]);
check('openWaitlist is defined', typeof w.openWaitlist === 'function');
check('the modal carries the waitlist id', doc.getElementById('waitlist') !== null);

const ctas = [...doc.querySelectorAll('a[onclick*="openWaitlist"]')];
check('every CTA opens the waitlist', ctas.length === 9, ctas.length);
check('and points at /accelerator/#waitlist',
  ctas.every((a) => a.getAttribute('href') === '/accelerator/#waitlist'), ctas.map((a) => a.getAttribute('href')));
check('none of them still says "Join the cohort"',
  !ctas.some((a) => /Join the cohort|Claim both seats/.test(a.textContent)));
check('the track() calls were kept', ['join_announce', 'join_nav', 'join_menu', 'join_hero',
  'join_weeks', 'join_includes', 'join_seats', 'join_final', 'join_sticky']
  .every((t) => HTML.includes("track('" + t + "')")));

console.log('\nthe form posts what the Worker expects');
const form = doc.getElementById('waitlistForm');
check('first name, email and a honeypot named _gotcha',
  form.querySelector('#wFirstName').name === 'first_name' &&
  form.querySelector('#wEmail').name === 'email' &&
  form.querySelector('#wGotcha').name === '_gotcha');
check('the honeypot is parked off-screen',
  /\.m-pot \{[^}]*left: -10000px/.test(HTML));

// Empty submit is refused on the page.
form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
await new Promise((r) => setTimeout(r, 20));
check('an empty form posts nothing', posts.length === 0, posts.length);

doc.getElementById('wFirstName').value = 'Alex';
doc.getElementById('wEmail').value = 'alex@example.com';
form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
await new Promise((r) => setTimeout(r, 40));
check('one POST to the worker waitlist route', posts.length === 1 &&
  posts[0].url === 'https://time-rich-forms.timerich.workers.dev/waitlist',
  posts.map((p) => p.url));
check('with first_name, email and _gotcha',
  JSON.stringify(Object.keys(posts[0].body).sort()) === JSON.stringify(['_gotcha', 'email', 'first_name']),
  posts[0] && Object.keys(posts[0].body));
check('carrying what was typed',
  posts[0].body.first_name === 'Alex' && posts[0].body.email === 'alex@example.com', posts[0].body);
check('and the card says they are on the list',
  /You’re on the waitlist!!/.test(doc.querySelector('#waitlist .join-modal-header').textContent) &&
  /We’ll email you first when Cohort 2 opens\./.test(doc.querySelector('#waitlist .join-modal-header').textContent),
  doc.querySelector('#waitlist .join-modal-header').textContent);

console.log('\nCohort 2, five weeks, no Cohort 1 dates');
check('the cohort and its month are on the page', /Cohort 2/.test(HTML) && /February 2027/.test(HTML));
check('no number of live sessions is stated',
  !/live sessions/i.test(HTML) && !/<b>9<\/b>|<b>10<\/b>/.test(HTML),
  (HTML.match(/.{0,40}live sessions.{0,20}/i) || [])[0]);
check('the Monday and Friday rhythm says it instead',
  (HTML.match(/every Monday and Friday/g) || []).length >= 4,
  (HTML.match(/every Monday and Friday/g) || []).length);
check('five weeks where the length is stated',
  /built by you in 5 weeks/.test(HTML) && /A 5-week live intensive/.test(HTML) &&
  /<b>5<\/b><p>weeks/.test(HTML) &&
  /5 weeks &middot; live every Monday and Friday/.test(HTML));
check('no Cohort 1 date survives',
  !/26 Oct|2 Nov|9 Nov|16 Nov|20 Nov|28 Oct|30 Oct|6 Nov|13 Nov|18 Nov|Monday 26 October/.test(HTML));
check('the weekly topics are all still there',
  ['Open Business Surgery', 'Your AI Operating System', 'Storytelling for GTM',
   'Unfair AI Advantage', 'Multi-LLM &amp; Setting Your Harness', 'Training Your Agent',
   'Expert Q&amp;A', 'The AI Content Machine + Q&amp;A', 'Networking Session',
   'Q&amp;A: Exited Founder'].every((t) => HTML.includes(t)));
check('and so are the coaches',
  ['Cien Solon', 'Taylor Offer', 'Terry Rice', 'Matyas Kolsofszki'].every((c) => HTML.includes(c)));
check('the weekday rhythm replaced the dates',
  [...doc.querySelectorAll('.wk-date')].every((d) => /^(Monday|Wednesday|Friday)$/.test(d.textContent)),
  [...doc.querySelectorAll('.wk-date')].map((d) => d.textContent));
check('the second seat is still explained, without a price',
  /Two seats, one ticket\./.test(HTML) && /2<\/b><p>seats per ticket/.test(HTML) &&
  !/for the price of 1/.test(HTML));
check('the guarantee is kept, in relative terms',
  /first two Monday build sessions/.test(HTML) && /by the end of week 2/.test(HTML) &&
  /refund you in full/.test(HTML));
check('no scarcity line is left',
  !/Limited spots|seats left|countdown/i.test(doc.body.textContent));

console.log('\nthe eight-question flow is gone: markup, script and styles');
check('the section is off the page',
  doc.getElementById('before-you-join') === null && doc.getElementById('qflow') === null);
check('and nothing links to it', doc.querySelector('a[href="#before-you-join"]') === null);
check('its script went with it',
  !/getElementById\('qflow'\)|data-step="8"|qscreen/.test(HTML));
check('its styles went too',
  !/\.qflow\{|\.qscreens\{|\.qscreen\.is-in|\.opt\[aria-pressed|\.s-form /.test(HTML));
check('and its own track event went with its button', !/join_form/.test(HTML));
check('a visitor is never asked eight questions',
  !/8 questions, 3 minutes|Tell us what you.re building/.test(HTML));
check('the waitlist modal is the only form left',
  doc.querySelectorAll('form').length === 1 && doc.querySelector('form').id === 'waitlistForm');
check('and it asks for a name, an email and the honeypot, nothing else',
  doc.querySelectorAll('#waitlistForm input').length === 3,
  [...doc.querySelectorAll('#waitlistForm input')].map((i) => i.name));

console.log('\nthe cost question is a how-do-I-get-in question now');
{
  const titles = [...doc.querySelectorAll('.faq-summary h3')].map((h) => h.textContent);
  check('it is retitled', titles.includes('How do I get a seat?') &&
    !titles.includes('What does it cost?'), titles);
  const item = [...doc.querySelectorAll('.faq-item')]
    .find((i) => /How do I get a seat\?/.test(i.textContent));
  check('and the answer still names the waitlist, with no price',
    /Cohort 2 opens to the waitlist first/.test(item.textContent) && !/\$/.test(item.textContent),
    item.textContent.replace(/\s+/g, ' ').trim());
}

console.log('\n/join/ is a redirect to the form');
check('it is noindexed', /<meta name="robots" content="noindex">/.test(JOIN));
check('with a meta refresh to the waitlist',
  /<meta http-equiv="refresh" content="0; url=\/accelerator\/#waitlist">/.test(JOIN));
check('and a script that gets there first, keeping the query',
  /window\.location\.replace\('\/accelerator\/' \+ window\.location\.search \+ '#waitlist'\)/.test(JOIN));
check('canonical points at the accelerator page',
  /<link rel="canonical" href="https:\/\/timerich\.ai\/accelerator\/">/.test(JOIN));
check('and none of the old checkout page is left',
  !/checkout\.timerich\.ai|Three questions. Thirty seconds/i.test(JOIN) &&
  !/<form|m-input/.test(JOIN));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
dom.window.close();
process.exit(fail ? 1 : 0);
