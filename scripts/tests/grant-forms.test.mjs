// The two grant application forms, driven in jsdom: /ffg and /stanley.
//
// The rule they exist to pin: a submission only reaches the thank-you page
// when the Worker says it saved. Anything else leaves the answers on screen,
// because the applicant has just typed a dozen of them.
//
// One suite, run twice. The two pages are deliberately the same machine with
// different questions, so a behaviour that holds for one has to hold for the
// other, and a fix to one that misses the other fails here.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const site = (rel) => fileURLToPath(new URL('../../' + rel, import.meta.url));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Every question answered, shaped exactly as each page stores it. The entry
// steps screen is data-require-all, so all four boxes have to be ticked.
const ENTRY_STEPS = [
  'Tagged or sent this to 2 founders',
  'Subscribed to timerichclub.com',
  'Followed Ella Molony Cook on LinkedIn',
  'Followed Time Rich on LinkedIn',
];

const FORMS = [
  {
    name: 'ffg',
    page: 'ffg/index.html',
    url: 'https://timerich.ai/ffg/',
    endpoint: 'https://time-rich-forms.timerich.workers.dev/ffg',
    storeKey: 'ffgApply',
    thanksKey: 'ffgThanks',
    thanksUrl: '/ffg/thanks/',
    formVersion: 'ffg-v1',
    answers: {
      full_name: 'Ada Lovelace',
      email: 'ada@example.com',
      linkedin: 'linkedin.com/in/ada',
      woman_founder: 'Yes',
      company: 'We build analytical engines.',
      stage: 'Pre-seed',
      revenue: 'Pre-revenue',
      why: 'Because the engine needs a programmer.',
      lisbon: 'Yes',
      show_up: 'Yes',
      entry_steps: ENTRY_STEPS,
    },
    // Keys only this form sends, which the Worker files in its own columns.
    only: ['woman_founder', 'lisbon'],
  },
  {
    name: 'stanley',
    page: 'stanley/index.html',
    url: 'https://timerich.ai/stanley/',
    endpoint: 'https://time-rich-forms.timerich.workers.dev/stanley',
    storeKey: 'stanleyApply',
    thanksKey: 'stanleyThanks',
    thanksUrl: '/stanley/thanks/',
    formVersion: 'stanley-v1',
    answers: {
      full_name: 'Grace Hopper',
      email: 'grace@example.com',
      linkedin: 'https://www.linkedin.com/in/grace',
      company: 'We build compilers.',
      stage: 'Seed',
      revenue: 'Pre-revenue',
      platforms: ['LinkedIn', 'X'],
      posts: 'Three a week',
      followers: '12,000',
      why: 'Building in public already.',
      show_up: 'Yes',
      entry_steps: ENTRY_STEPS,
      share_stanley: 'Happy to',
    },
    only: ['platforms', 'posts', 'followers', 'share_stanley'],
  },
];

// jsdom will not navigate and its location.replace cannot be stubbed or
// redefined, so a redirect shows up as a jsdomError. That, plus the two
// sessionStorage writes the page makes just before it leaves, is what "went
// to the thanks page" means here; the destination itself is asserted off the
// page source.
function boot(form, { reply } = {}) {
  const vc = new VirtualConsole();
  const sent = [];
  const navigated = [];
  vc.on('jsdomError', (err) => {
    if (/navigation/i.test(String(err && err.message))) navigated.push('navigate');
  });
  const dom = new JSDOM(form.html, {
    url: form.url,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      // A complete application already in progress, so the test can submit
      // without walking every screen.
      w.sessionStorage.setItem(form.storeKey, JSON.stringify({ answers: form.answers, idx: 99 }));
      w.fetch = (url, init) => {
        sent.push({ url: String(url), init, body: JSON.parse(init.body) });
        // Node's Response, not w.Response: jsdom's window has no Response.
        return reply ? reply() : Promise.resolve(new Response('{"ok":true}', { status: 200 }));
      };
    },
  });
  return { dom, document: dom.window.document, window: dom.window, sent, navigated };
}

const fire = (page) => page.document.getElementById('applyForm')
  .dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));
const submit = async (page) => { fire(page); for (let i = 0; i < 20; i++) await sleep(0); };
const errorText = (page) => page.document.getElementById('e-submit').textContent.trim();
const button = (page) => page.document.getElementById('submitBtn');
const ERROR = 'Something went wrong. Please try again, or email emc@timerich.ai.';

for (const form of FORMS) {
  form.html = fs.readFileSync(site(form.page), 'utf8');

  console.log('\n/' + form.name + ' — a saved application');
  {
    const page = boot(form);
    await submit(page);

    check('the answers are POSTed to its own route',
      page.sent.length === 1 && page.sent[0].url === form.endpoint,
      page.sent.map((s) => s.url));
    check('as JSON', page.sent[0].init.method === 'POST' &&
      /application\/json/.test(page.sent[0].init.headers['Content-Type']));
    check('carrying every answer and the form version',
      Object.keys(form.answers).every((k) => k in page.sent[0].body) &&
      page.sent[0].body.form_version === form.formVersion &&
      page.sent[0].body.entry_steps.length === 4,
      page.sent[0].body);
    check('including the keys only this form has',
      form.only.every((k) => k in page.sent[0].body), form.only);
    check('and the honeypot, so the Worker can see it is empty',
      page.sent[0].body._gotcha === '', page.sent[0].body._gotcha);
    check('only then does it leave for the thank-you page',
      page.navigated.length === 1, page.navigated);
    check('and that page is ' + form.thanksUrl,
      form.html.includes("var THANKS_URL = '" + form.thanksUrl + "'"));
    check('the first name is handed to that page',
      page.window.sessionStorage.getItem(form.thanksKey) ===
        form.answers.full_name.split(' ')[0]);
    check('and the in-progress application is cleared',
      page.window.sessionStorage.getItem(form.storeKey) === null);
    check('no error is shown', errorText(page) === '', errorText(page));
  }

  console.log('\n/' + form.name + ' — when the save fails');
  {
    const page = boot(form, { reply: () => Promise.resolve(new Response('{"ok":false}', { status: 500 })) });
    await submit(page);

    check('it does not go to the thank-you page', page.navigated.length === 0, page.navigated);
    check('it says so, and says where to turn', errorText(page) === ERROR, errorText(page));
    check('the answers are still there to send again',
      page.window.sessionStorage.getItem(form.storeKey) !== null);
    check('and the button goes back to being pressable',
      button(page).disabled === false && button(page).textContent !== 'Sending…',
      button(page).textContent);

    await submit(page);
    check('so a second attempt really does send again', page.sent.length === 2, page.sent.length);
  }

  {
    // A dropped connection, not an error status.
    const page = boot(form, { reply: () => Promise.reject(new Error('offline')) });
    await submit(page);
    check('a network failure is handled the same way',
      page.navigated.length === 0 && errorText(page) === ERROR && button(page).disabled === false,
      errorText(page));
  }

  {
    const page = boot(form, { reply: () => Promise.resolve(new Response('{"ok":false}', { status: 400 })) });
    await submit(page);
    check('a 400 is a failure too, not a quiet success',
      page.navigated.length === 0 && errorText(page) !== '');
  }

  console.log('\n/' + form.name + ' — while it is sending');
  {
    let release;
    const held = new Promise((r) => { release = r; });
    const page = boot(form, { reply: () => held });
    fire(page);
    await sleep(0);

    check('the button is disabled and says so',
      button(page).disabled === true && button(page).textContent === 'Sending…',
      button(page).textContent);

    await submit(page);
    check('a double submit sends nothing extra', page.sent.length === 1, page.sent.length);

    release(new Response('{"ok":true}', { status: 200 }));
    for (let i = 0; i < 20; i++) await sleep(0);
    check('and the redirect happens once it comes back', page.navigated.length === 1, page.navigated);
  }
}

console.log('\nBoth grant forms are wired');
{
  for (const form of FORMS) {
    check('/' + form.name + ' has no "no network submit yet" placeholder left',
      !/No network submit yet/.test(form.html));
    check('/' + form.name + ' points at its own Worker route',
      form.html.includes("var FORM_ENDPOINT = '" + form.endpoint + "'"));
  }
  check('the two forms post to different routes',
    FORMS[0].endpoint !== FORMS[1].endpoint);
  check('both name the same contact address on failure',
    FORMS.every((f) => f.html.includes('email emc@timerich.ai.')));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
