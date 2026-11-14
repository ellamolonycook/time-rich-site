/* The Club feedback form: the page, the pill and the side panel.
 *
 * Ella, 6 Nov: the form worked but looked raw, and members could not find it
 * without hunting. So there is one component now -- two steps and a
 * thank-you -- mounted by portal-chrome.js in two places: the full page at
 * /club/feedback, which exists so a link in an email or Zoom chat still
 * works, and a panel that slides in from a pill on every other Club page.
 *
 * The field names are the contract with the Worker, which is the contract
 * with Notion. Most of this file is about those names, and about the pill
 * never covering anything.
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const HTML = read('club/feedback.html');
const CHROME = read('club/portal-chrome.js');
const CSS = read('club/portal-content.css');
const ACCESS = read('club/portal-access.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/* A Club page with the chrome running on it. The feedback component needs
   nothing from the payload except the member's first name, so the session is
   mocked only as far as that. */
function openPage(file, opts = {}) {
  const dom = new JSDOM(read('club/' + file), {
    url: 'https://timerich.ai/club/' + file.replace(/\.html$/, ''),
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),
    beforeParse(window) {
      window.tailwind = {};
      window.gtag = () => {};
      // The pill arrives on a timer and the thank-you settles on another.
      // The settle is shortened so nothing waits on a real three seconds.
      window.TR_FEEDBACK_SETTLE_MS = opts.settleMs ?? 5;
      window.TR_PORTAL_DATA = { ok: true, member: { first_name: 'Eve' }, weeks: [], sessions: [] };
      window.posts = [];
      window.fetch = (url, init) => {
        window.posts.push({ url: String(url), body: JSON.parse(init.body) });
        return Promise.resolve({
          ok: opts.httpOk !== false,
          json: () => Promise.resolve(opts.reply ?? { ok: opts.replyOk !== false }),
        });
      };
    },
  });
  /* jsdom does not fetch a script src, so the chrome is run by hand, the way
     the browser would run it. It has to wait for parsing to finish first:
     the JSDOM constructor returns while readyState is still "loading", and
     the file mounts on DOMContentLoaded. */
  return new Promise((resolve) => {
    function go() { dom.window.eval(CHROME); resolve(dom); }
    if (dom.window.document.readyState === 'loading') {
      dom.window.document.addEventListener('DOMContentLoaded', go);
    } else {
      go();
    }
  });
}

// jsdom has no layout, so offsetParent is null for everything and the focus
// trap would see no focusable children. This gives it what it needs.
function fakeLayout(window) {
  Object.defineProperty(window.HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() { return this.ownerDocument.body; },
  });
}

/* ---- the page ---------------------------------------------------------- */

console.log('\nthe page is one centred column, and carries no form of its own');
{
  const doc = new JSDOM(HTML, { virtualConsole: new VirtualConsole() }).window.document;

  check('the session gate is on the page', /<html[^>]*data-trp-gate/.test(HTML));
  check('and it loads the gate script', HTML.includes('portal-access.js'));
  check('with no sign-in form, so a signed-out visitor is redirected',
    doc.querySelector('[data-portal-login]') === null &&
    /function signedOut\(\)[\s\S]*?window\.location\.replace\('signin'\);/.test(ACCESS));

  check('there is one column for the form to sit in',
    doc.querySelectorAll('.trp-fb-wrap').length === 1);
  check('the column is capped at 600px and gutters on a phone',
    /\.trp-fb-wrap \{[^}]*max-width: 600px[^}]*padding: 0 16px/.test(CSS));
  check('the back link is above it, in the column',
    doc.querySelector('.trp-fb-wrap > .trp-fb-back') !== null);

  const head = doc.querySelector('.trp-fb-head');
  check('the heading block is centred', head !== null && /text-align: center/.test(
    (CSS.match(/\.trp-fb-head \{[^}]*\}/) || [''])[0]));
  check('the eyebrow reads FEEDBACK',
    head.querySelector('.trp-fb-eyebrow').textContent === 'Feedback' &&
    /\.trp-fb-eyebrow \{[^}]*text-transform: uppercase/.test(CSS));
  check('the h1 is Ella\'s line, with the green stop kept',
    /Tell us how it’s going/.test(head.querySelector('h1').textContent) &&
    head.querySelector('h1 .trp-stop') !== null);
  check('and the h1 is smaller than a page title',
    /\.trp-fb-h1 \{[^}]*font-size: clamp\(24px, 4vw, 30px\)/.test(CSS),
    (CSS.match(/\.trp-fb-h1 \{[^}]*\}/) || [])[0]);
  check('the one line under it is unchanged',
    head.querySelector('.trp-fb-lede').textContent === '2 minutes. It shapes the next cohort.');

  check('the page itself has no form markup: the component builds it',
    doc.querySelector('form') === null && doc.querySelector('[data-feedback-mount]') !== null);
  check('and no script of its own',
    !/data-feedback-form|time-rich-forms.*feedback/.test(
      HTML.slice(HTML.indexOf('</main>'))));
  check('the component is in the chrome every Club page loads',
    /function buildFeedback/.test(CHROME) && HTML.includes('portal-chrome.js'));
}

console.log('\nthe honeypot is off-screen, not a box above "Your email"');
{
  const dom = await openPage('feedback.html');
  const doc = dom.window.document;
  const pot = doc.querySelector('.trp-fb-pot');

  check('the honeypot is in the form', pot !== null && pot.name === '_gotcha');
  /* It sits ahead of the email field in the markup, which is exactly why an
     unstyled one drew as a box above "Your email". */
  const inputs = [...doc.querySelector('[data-feedback-form]').querySelectorAll('input')];
  check('it comes before the email field in the markup',
    pot !== null && inputs.indexOf(pot) < inputs.indexOf(doc.querySelector('input[name="Email"]')),
    [inputs.indexOf(pot), inputs.map((i) => i.name)]);

  // The rule that takes it out of the page. jsdom has no layout, so the
  // stylesheet is what is read -- which is the whole bug: there was no rule.
  const rule = (CSS.match(/\.trp-fb-pot \{[^}]*\}/) || [''])[0];
  check('it has a rule of its own at all', rule !== '', rule);
  check('parked 10000px off to the left, out of the flow',
    /position: absolute !important/.test(rule) &&
    /left: -10000px !important/.test(rule) &&
    /top: auto/.test(rule), rule);
  check('and given no size or ink',
    /width: 1px/.test(rule) && /height: 1px/.test(rule) &&
    /overflow: hidden/.test(rule) && /opacity: 0/.test(rule), rule);
  check('it is still rendered, so a bot will fill it in',
    !/display: none/.test(rule) && !/visibility: hidden/.test(rule), rule);
  check('and still hidden from a screen reader and the Tab key',
    pot.getAttribute('aria-hidden') === 'true' && pot.tabIndex === -1,
    [pot.getAttribute('aria-hidden'), pot.tabIndex]);

  // It is the same component in the panel, so it is covered there too.
  check('the testimonial form has one as well, with the same class',
    read('club/portal-chrome.js').includes("el('input', 'trp-fb-pot')") &&
    (CHROME.match(/function honeypot/g) || []).length === 1);

  check('every Club page asks for today’s stylesheet, so the rule arrives',
    ['index', 'dashboard', 'curriculum', 'resources', 'prompts', 'members',
     'feedback', 'testimonial'].every((name) =>
      read('club/' + name + '.html').includes('portal-content.css?v=20261109')));
  dom.window.close();
}

console.log('\nthe component mounts on the page, in two steps');
{
  const dom = await openPage('feedback.html');
  const doc = dom.window.document;
  const form = doc.querySelector('[data-feedback-form]');
  check('the form is built into the page', form !== null);

  const steps = [...doc.querySelectorAll('.trp-fb-step')];
  check('there is a two-step indicator', steps.length === 2, steps.length);
  check('reading Feedback then Next cohort',
    steps.map((s) => s.textContent).join('|') === '1Feedback|2Next cohort',
    steps.map((s) => s.textContent));
  check('step 1 is the one filled in', steps[0].classList.contains('is-on') &&
    !steps[1].classList.contains('is-on'));
  check('with a thin line between them',
    doc.querySelector('.trp-fb-steps .trp-fb-step-line') !== null);
  check('the filled pip is dark green, the other outlined',
    /\.trp-fb-step\.is-on \.trp-fb-step-n \{[^}]*background: rgb\(var\(--c-green\)\)/.test(CSS) &&
    /\.trp-fb-step-n \{[^}]*border: 1px solid var\(--trp-rule\)/.test(CSS));

  check('step 1 is showing and step 2 is not',
    doc.querySelector('[data-feedback-step="1"]').hidden === false &&
    doc.querySelector('[data-feedback-step="2"]').hidden === true);

  /* ---- step 1's shape: Ella's six questions, mostly tapped ---- */

  const step1 = doc.querySelector('[data-feedback-step="1"]');
  const text1 = step1.textContent.replace(/\s+/g, ' ');
  check('it opens by asking how it is going, and says to tap',
    /How’s it going\?/.test(text1) && /Tap to answer\./.test(text1), text1.slice(0, 80));
  check('email is first, and still required',
    form.querySelector('input[name="Email"]') !== null &&
    form.querySelector('input[name="Email"]').required === true);
  check('with the helper line Ella asked for',
    /So we can thank you, and reach you about the Testimonial Prize\./.test(text1));

  // The questions, in order, with the labels the brief gives.
  const legends = [...step1.querySelectorAll('legend')].map((l) => l.textContent);
  check('four tapped questions, in Ella\'s order',
    legends.length === 4 &&
    legends[0] === 'What have you built so far? (tap all that apply)' &&
    legends[1] === 'Time saved this week?' &&
    legends[2] === 'What’s slowing you down?' &&
    legends[3] === 'Would you tell a founder friend to join the next cohort?',
    legends);

  const groups = [...step1.querySelectorAll('.trp-fb-chips')];
  check('each is a row of chips', groups.length === 4, groups.length);
  const vals = (i) => [...groups[i].querySelectorAll('input')].map((n) => n.value);
  check('"built so far" is multi-select, with the seven things',
    [...groups[0].querySelectorAll('input')].every((n) => n.type === 'checkbox') &&
    vals(0).join('|') === ['Business Hub', 'Business COMPASS', 'Sales Floor / CRM',
      'Daily number', 'Stanley set up', 'First post live', 'An agent running'].join('|'),
    vals(0));
  check('time saved is one of four, single choice',
    [...groups[1].querySelectorAll('input')].every((n) => n.type === 'radio') &&
    vals(1).join('|') === 'None yet|1–2 hours|3–5 hours|6+ hours', vals(1));
  check('what is slowing them down is one of five',
    [...groups[2].querySelectorAll('input')].every((n) => n.type === 'radio') &&
    vals(2).join('|') === ['Finding the time', 'Tech setup', 'Not sure what to do next',
      'Knowing what to post', 'Nothing, I’m flying'].join('|'), vals(2));
  check('and the recommendation is Yes, Maybe or Not yet',
    [...groups[3].querySelectorAll('input')].every((n) => n.type === 'radio') &&
    vals(3).join('|') === 'Yes|Maybe|Not yet', vals(3));
  check('a radio group is one group, so only one chip can be on at a time',
    new Set([...groups[1].querySelectorAll('input')].map((n) => n.name)).size === 1);
  check('the chips wrap rather than sitting on a grid of equal columns',
    /\.trp-fb-chips \{ display: flex; flex-wrap: wrap/.test(CSS));
  check('the chosen chip fills dark green',
    /\.trp-fb-chips input:checked \+ \.trp-fb-chip \{[^}]*background: rgb\(var\(--c-green\)\)/.test(CSS));

  // The written answers: the sessions question, then Ella's three open ones.
  const areas = [...step1.querySelectorAll('textarea')];
  check('four written answers, named for the Notion columns, in Ella’s order',
    areas.map((a) => a.name).join('|') === ['Learn in last sessions', 'Biggest unlock',
      'Favorite teachers', 'How can we improve'].join('|'), areas.map((a) => a.name));
  const labelOf = (area) => doc.querySelector('label[for="' + area.id + '"]')
    .textContent.replace(/\s+/g, ' ');
  check('asking what the biggest unlock was',
    labelOf(areas[1]) === 'What was the biggest unlock for you? (optional)', labelOf(areas[1]));
  check('who their favourite teachers were',
    labelOf(areas[2]) === 'Who were your favorite teachers? (optional)', labelOf(areas[2]));
  check('and how we can improve',
    labelOf(areas[3]) === 'How can we improve? (optional)', labelOf(areas[3]));
  check('all three optional, so nothing new blocks Send',
    areas.slice(1).every((a) => a.required === false));
  check('and the old win-or-change box is gone',
    step1.querySelector('[name="Win or change"]') === null &&
    !/One win, or one thing to change/.test(CHROME));
  check('both grow as you type, capped around six lines',
    /function autoGrow/.test(CHROME) && /line \* 6/.test(CHROME));
  const learnLabel = doc.querySelector('label[for="' + areas[0].id + '"]');
  check('the sessions question says to say it with Wispr Flow',
    /What would you like to request for Week 4\? \(say it with Wispr Flow\)/
      .test(learnLabel.textContent.replace(/\s+/g, ' ')), learnLabel.textContent);
  const wispr = learnLabel.querySelector('a');
  check('and Wispr Flow is the promo link, in a new tab',
    wispr.getAttribute('href') === 'https://wisprflow.ai/info/redeem-promo?code=TIMERICH6&months=6' &&
    wispr.getAttribute('target') === '_blank' && /noopener/.test(wispr.getAttribute('rel')),
    wispr.getAttribute('href'));
  check('every written answer grows the same way',
    areas.every((a) => a.rows === 2 && a.className === 'trp-fb-area'));

  // What the old form had and this one does not.
  check('the 1 to 10 rating is gone',
    form.querySelector('[name="Rating"]') === null && !/name = .Rating./.test(CHROME));
  check('and so are the old written answers',
    form.querySelector('[name="Most useful"]') === null &&
    form.querySelector('[name="One thing to change"]') === null);
  check('the old testimonial step is off this form',
    form.querySelector('[name="LinkedIn video post"]') === null &&
    form.querySelector('[data-feedback-rec]') === null);
  check('and "Link to it" is still gone',
    form.querySelector('[name="LinkedIn recommendation link"]') === null &&
    !/LinkedIn recommendation link/.test(HTML));
  dom.window.close();
}

/* ---- step 1 to step 2 to sent ------------------------------------------ */

/* Email is the only thing step 1 insists on now, so the helper fills that
   by default and takes the taps and the typing as extras. */
function fill(doc, { email = 'eve@example.com', built, saved, slowing,
                     recommend, learn, unlock, teachers, improve } = {}) {
  const form = doc.querySelector('[data-feedback-form]');
  const view = doc.defaultView;
  const set = (node, value) => {
    node.value = value;
    node.dispatchEvent(new view.Event('input', { bubbles: true }));
  };
  const tap = (groupIndex, value) => {
    const group = [...form.querySelectorAll('.trp-fb-chips')][groupIndex];
    const input = [...group.querySelectorAll('input')].find((n) => n.value === value);
    input.checked = true;
    input.dispatchEvent(new view.Event('change', { bubbles: true }));
  };
  if (email !== null) set(form.querySelector('input[name="Email"]'), email);
  if (built) built.forEach((v) => tap(0, v));
  if (saved) tap(1, saved);
  if (slowing) tap(2, slowing);
  if (recommend) tap(3, recommend);
  if (learn) set(form.querySelector('textarea[name="Learn in last sessions"]'), learn);
  if (unlock) set(form.querySelector('textarea[name="Biggest unlock"]'), unlock);
  if (teachers) set(form.querySelector('textarea[name="Favorite teachers"]'), teachers);
  if (improve) set(form.querySelector('textarea[name="How can we improve"]'), improve);
  return form;
}
const clickOn = (doc, sel) => {
  const node = doc.querySelector(sel);
  node.dispatchEvent(new doc.defaultView.MouseEvent('click', { bubbles: true }));
  return node;
};

console.log('\nNext is blocked until there is an email');
{
  const dom = await openPage('feedback.html');
  const doc = dom.window.document;
  const next = doc.querySelector('[data-feedback-next]');

  check('Next starts unavailable', next.getAttribute('aria-disabled') === 'true');
  clickOn(doc, '[data-feedback-next]');
  check('tapping it early does not advance',
    doc.querySelector('[data-feedback-step="2"]').hidden === true);
  const hint = doc.querySelector('[data-feedback-step="1"] .trp-fb-msg');
  check('and a hint asks for the email', hint.hidden === false && /email/i.test(hint.textContent),
    hint.textContent);

  check('a half-typed address is not enough',
    (fill(doc, { email: 'eve@' }), next.getAttribute('aria-disabled') === 'true'));

  // An email is all it wants: the taps are Ella's questions, not a gate.
  fill(doc);
  check('with an email, Next becomes available', next.getAttribute('aria-disabled') === 'false');
  check('and the hint is put away', hint.hidden === true);
  clickOn(doc, '[data-feedback-next]');
  check('step 2 replaces step 1',
    doc.querySelector('[data-feedback-step="1"]').hidden === true &&
    doc.querySelector('[data-feedback-step="2"]').hidden === false);
  check('the indicator moves with it',
    doc.querySelectorAll('.trp-fb-step')[1].classList.contains('is-on') &&
    !doc.querySelectorAll('.trp-fb-step')[0].classList.contains('is-on'));
  check('focus moves to the step 2 heading',
    doc.activeElement === doc.querySelector('[data-feedback-step2-head]'),
    doc.activeElement && doc.activeElement.className);
  check('and Back takes them home again',
    (clickOn(doc, '[data-feedback-back]'),
     doc.querySelector('[data-feedback-step="1"]').hidden === false));
  dom.window.close();
}

console.log('\nstep 2 asks who should be in the next cohort, and is optional');
{
  const dom = await openPage('feedback.html');
  const doc = dom.window.document;
  fill(doc);
  clickOn(doc, '[data-feedback-next]');
  const step2 = doc.querySelector('[data-feedback-step="2"]');
  const text = step2.textContent.replace(/\s+/g, ' ');

  check('the heading says so, and marks itself optional',
    /Who should be in the next cohort\? \(optional\)/.test(text), text.slice(0, 80));
  check('and it asks for the founders',
    /Which founders in your network should join the next cohort\?/.test(text));

  const rows = () => [...step2.querySelectorAll('[data-feedback-founder-row]')];
  check('one row to begin with', rows().length === 1, rows().length);
  check('of Name, LinkedIn and Email',
    rows()[0].querySelectorAll('input').length === 3 &&
    [...rows()[0].querySelectorAll('label')].map((l) => l.textContent).join('|') ===
      'Name|LinkedIn|Email',
    [...rows()[0].querySelectorAll('label')].map((l) => l.textContent));
  check('side by side on a laptop, stacked on a phone',
    /@media \(min-width: 640px\) \{ \.trp-fb-row \{ grid-template-columns: minmax\(0, 1fr\)/.test(CSS) &&
    /\.trp-fb-row \{ display: grid; grid-template-columns: minmax\(0, 1fr\); gap: 10px/.test(CSS));

  const add = step2.querySelector('[data-feedback-founder-add]');
  check('with a way to add another', add !== null && add.textContent === '+ Add another');
  for (let i = 0; i < 4; i++) add.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  check('up to five rows', rows().length === 5, rows().length);
  check('and then the button takes itself away', add.hidden === true);
  add.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  check('so a sixth cannot be added', rows().length === 5, rows().length);

  check('one checkbox under them, unticked',
    doc.querySelector('[data-feedback-feature]').checked === false &&
    /Time Rich can share my feedback/.test(text));
  check('and it no longer says "and testimonial", which is its own page now',
    !/share my feedback and testimonial/.test(text));

  const go = step2.querySelector('[data-feedback-testimonial-link]');
  check('a line points at the testimonial page',
    go !== null && go.getAttribute('href') === '/club/testimonial' &&
    go.textContent === 'Upload your video testimonial to WIN',
    go && go.getAttribute('href'));
  check('introduced the way Ella wrote it',
    /🏆 Got a minute later\? Upload your video testimonial to WIN/.test(text), text);

  check('the footer has Back on the left', step2.querySelector('[data-feedback-back]') !== null);
  check('and Send it on the right',
    step2.querySelector('.trp-fb-foot-right [data-feedback-send]') !== null);
  check('the Skip button is gone: step 2 is optional in itself',
    step2.querySelector('[data-feedback-skip]') === null);
  dom.window.close();
}

console.log('\nSend posts once, with the names the Worker expects');
{
  const dom = await openPage('feedback.html');
  const doc = dom.window.document;
  fill(doc, {
    built: ['Business Hub', 'Daily number'],
    saved: '3–5 hours',
    slowing: 'Finding the time',
    recommend: 'Yes',
    learn: 'More on agents.',
    unlock: 'Delegating to an agent.',
    teachers: 'Ella and the hot seats.',
    improve: 'More time on the prompts.',
  });
  clickOn(doc, '[data-feedback-next]');

  const rows = [...doc.querySelectorAll('[data-feedback-founder-row]')];
  const type = (row, i, value) => { row.querySelectorAll('input')[i].value = value; };
  type(rows[0], 0, 'Ada');
  type(rows[0], 1, 'linkedin.com/in/ada');
  type(rows[0], 2, 'ada@example.com');
  doc.querySelector('[data-feedback-founder-add]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  const second = [...doc.querySelectorAll('[data-feedback-founder-row]')][1];
  type(second, 0, 'Grace');                         // a part-filled row still counts
  doc.querySelector('[data-feedback-feature]').checked = true;

  const send = doc.querySelector('[data-feedback-send]');
  send.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  // Double-click safe: the second click must not post again.
  send.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await tick();

  const posts = dom.window.posts;
  check('one POST, not two', posts.length === 1, posts.length);
  check('to the Worker\'s /feedback route',
    posts[0].url === 'https://time-rich-forms.timerich.workers.dev/feedback', posts[0].url);

  const body = posts[0].body;
  const WANT = ['Name', 'Email', 'Built so far', 'Time saved', 'Slowing me down',
    'Would recommend', 'Learn in last sessions', 'Biggest unlock', 'Favorite teachers',
    'How can we improve', 'Founders to invite', 'OK to feature', 'Source', '_gotcha'];
  check('exactly the expected field names',
    JSON.stringify(Object.keys(body).sort()) === JSON.stringify([...WANT].sort()),
    Object.keys(body));
  check('the name came off the session', body.Name === 'Eve', body.Name);
  check('the email is carried', body.Email === 'eve@example.com', body.Email);
  check('the multi-select is the labels, joined with a comma',
    body['Built so far'] === 'Business Hub, Daily number', body['Built so far']);
  check('the single choices are the labels themselves',
    body['Time saved'] === '3–5 hours' && body['Slowing me down'] === 'Finding the time' &&
    body['Would recommend'] === 'Yes',
    [body['Time saved'], body['Slowing me down'], body['Would recommend']]);
  check('the written answers are carried',
    body['Learn in last sessions'] === 'More on agents.' &&
    body['Biggest unlock'] === 'Delegating to an agent.' &&
    body['Favorite teachers'] === 'Ella and the hot seats.' &&
    body['How can we improve'] === 'More time on the prompts.', body);
  check('the founders are one field, a line each, piped',
    body['Founders to invite'] === 'Ada | linkedin.com/in/ada | ada@example.com\nGrace |  | ',
    body['Founders to invite']);
  check('the checkbox ticked sends Yes', body['OK to feature'] === 'Yes');
  check('and Source is club-feedback', body.Source === 'club-feedback');

  check('the button said it was sending', /Sending/.test(send.textContent) ||
    doc.querySelector('[data-feedback-thanks]').hidden === false, send.textContent);
  dom.window.close();
}

console.log('\nnothing tapped and nothing typed still sends');
{
  const dom = await openPage('feedback.html');
  const doc = dom.window.document;
  fill(doc);
  clickOn(doc, '[data-feedback-next]');
  clickOn(doc, '[data-feedback-send]');
  await tick();
  const body = dom.window.posts[0].body;
  check('every unanswered question sends empty, not missing',
    body['Built so far'] === '' && body['Time saved'] === '' &&
    body['Slowing me down'] === '' && body['Would recommend'] === '', body);
  check('the empty founder row is dropped', body['Founders to invite'] === '',
    body['Founders to invite']);
  check('and an unticked box sends No', body['OK to feature'] === 'No', body['OK to feature']);
  dom.window.close();
}

/* ---- the thank-you ----------------------------------------------------- */

console.log('\nthe thank-you eases in, then settles');
{
  /* Three phases, 200ms apart and then the settle. The settle is given room
     here rather than the usual few milliseconds, so each phase can be
     watched in turn instead of all of them being over by the first look. */
  const dom = await openPage('feedback.html', { settleMs: 300 });
  const doc = dom.window.document;
  fill(doc);
  clickOn(doc, '[data-feedback-next]');
  clickOn(doc, '[data-feedback-send]');
  await tick();

  const thanks = doc.querySelector('[data-feedback-thanks]');
  // The form card lifts out first, then the card comes in 200ms later.
  check('the form card is on its way out',
    doc.querySelector('[data-feedback-form]').classList.contains('trp-fb-anim-out'));
  check('and the lift is a fade and an 8px rise',
    /\.trp-fb-anim-out \{[^}]*opacity: 0;[^}]*translateY\(-8px\)[^}]*200ms/.test(CSS),
    (CSS.match(/\.trp-fb-anim-out \{[^}]*\}/) || [])[0]);

  await new Promise((r) => setTimeout(r, 260));
  check('the thank-you card is showing', thanks.hidden === false);
  check('it is announced to a screen reader',
    thanks.getAttribute('role') === 'status' && thanks.getAttribute('aria-live') === 'polite');
  check('and focus moved to it', doc.activeElement === thanks, doc.activeElement.className);
  check('it eases in from 0.96, 280ms',
    thanks.classList.contains('trp-fb-anim-in') &&
    /@keyframes trp-fb-in \{ from \{ opacity: 0; transform: scale\(\.96\)/.test(CSS) &&
    /\.trp-fb-anim-in \{ animation: trp-fb-in 280ms ease-out both/.test(CSS));
  check('with a check that draws itself',
    thanks.querySelector('.trp-fb-thanks-ring svg') !== null &&
    /@keyframes trp-fb-draw/.test(CSS) &&
    /animation: trp-fb-draw 400ms/.test(CSS));
  check('it says Thank you!!',
    /Thank you!! 💚/.test(thanks.textContent), thanks.textContent);
  check('it thanks them for the feedback itself',
    thanks.textContent.includes('This genuinely shapes what we build next.'),
    thanks.textContent);
  check('and points at the testimonial page, which is the next thing to do',
    thanks.querySelector('[data-feedback-testimonial-link]') !== null &&
    thanks.querySelector('[data-feedback-testimonial-link]').getAttribute('href') ===
      '/club/testimonial');

  // Then it settles, in the same spot.
  await new Promise((r) => setTimeout(r, 320));
  check('it settles into a calm final state',
    thanks.querySelector('.trp-fb-settled') !== null &&
    thanks.classList.contains('trp-fb-anim-settle'));
  check('reading "Feedback sent"',
    /Feedback sent ✓/.test(thanks.textContent), thanks.textContent);
  const done = thanks.querySelector('[data-feedback-done]');
  check('with a way back to the course',
    done !== null && done.getAttribute('href') === '/club/curriculum',
    done && done.getAttribute('href'));
  check('the settled state points at the testimonial page too',
    thanks.querySelector('[data-feedback-testimonial-link]') !== null);
  check('and the page did not go blank', doc.querySelector('.trp-fb-wrap') !== null);
  dom.window.close();
}

console.log('\nwith reduced motion, nothing moves');
{
  check('every animated piece has its transforms cancelled',
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?transform: none;[\s\S]*?animation: none;/.test(CSS));
  // The stylesheet already had a reduced-motion block long before this one,
  // so the block under test is picked by what is in it, not by being first.
  const block = (CSS.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\r?\n\}/g) || [])
    .find((b) => b.includes('.trp-fb-anim-out')) || '';
  for (const cls of ['.trp-fb-anim-out', '.trp-fb-anim-in', '.trp-fb-anim-settle',
                     '.trp-pill', '.trp-panel', '.trp-panel-dim']) {
    check('and that covers ' + cls, block.includes(cls), block.slice(0, 200));
  }
  check('the check mark is simply drawn, not animated',
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?stroke-dashoffset: 0/.test(CSS));
}

console.log('\non an error the form stays put and keeps what they typed');
{
  const dom = await openPage('feedback.html', { httpOk: false, reply: { ok: false, error: 'Notion is down.' } });
  const doc = dom.window.document;
  fill(doc, { saved: '6+ hours', unlock: 'Keep this.' });
  clickOn(doc, '[data-feedback-next]');
  clickOn(doc, '[data-feedback-send]');
  await tick();

  check('the form is still there',
    doc.querySelector('[data-feedback-form]').hidden === false &&
    doc.querySelector('[data-feedback-thanks]').hidden === true);
  const err = doc.querySelector('[data-feedback-error]');
  check('the Worker\'s own message is shown',
    err.hidden === false && err.textContent === 'Notion is down.', err.textContent);
  check('in the error style', err.classList.contains('is-err'));
  check('and it sits above the buttons',
    err.nextElementSibling !== null && err.nextElementSibling.classList.contains('trp-fb-foot'));

  check('everything they typed and tapped is still there',
    doc.querySelector('input[name="Email"]').value === 'eve@example.com' &&
    doc.querySelector('textarea[name="Biggest unlock"]').value === 'Keep this.' &&
    [...doc.querySelectorAll('.trp-fb-chips input')]
      .some((n) => n.value === '6+ hours' && n.checked));
  check('and Send it can be pressed again',
    doc.querySelector('[data-feedback-send]').disabled === false &&
    doc.querySelector('[data-feedback-send]').textContent === 'Send it');
  dom.window.close();
}

/* ---- the pill ---------------------------------------------------------- */

console.log('\nthe pill is on every Club page but the form and sign-in');
{
  for (const page of ['index.html', 'dashboard.html', 'curriculum.html',
                      'resources.html', 'prompts.html', 'members.html']) {
    const dom = await openPage(page);
    const pill = dom.window.document.querySelector('[data-feedback-pill]');
    check(page + ': the pill is built', pill !== null);
    dom.window.close();
  }

  const onForm = await openPage('feedback.html');
  check('feedback.html: no pill, the page is the form',
    onForm.window.document.querySelector('[data-feedback-pill]') === null);
  onForm.window.close();

  check('signin.html does not load the chrome at all',
    !read('club/signin.html').includes('portal-chrome.js'));
  check('and the pill would refuse that address anyway',
    /NO_PILL = .*feedback\|testimonial\|signin/.test(CHROME),
    (CHROME.match(/var NO_PILL = .*/) || [])[0]);
}

console.log('\nthe pill looks and sits where Ella asked');
{
  const dom = await openPage('curriculum.html');
  const doc = dom.window.document;
  const pill = doc.querySelector('[data-feedback-pill]');

  check('it has a speech-bubble icon and a label',
    pill.querySelector('svg') !== null &&
    pill.querySelector('.trp-pill-text').textContent === 'Feedback');
  check('and an accessible name for the icon-only phone version',
    pill.getAttribute('aria-label') === 'Give feedback');
  check('the row is fixed bottom-right, with the safe-area inset',
    /\.trp-pills \{[\s\S]*?position: fixed[\s\S]*?env\(safe-area-inset-right\)[\s\S]*?env\(safe-area-inset-bottom\)/.test(CSS));
  check('40px tall, fully rounded, dark green on off-white',
    /\.trp-pill \{[\s\S]*?height: 40px[\s\S]*?border-radius: 999px[\s\S]*?background: rgb\(var\(--c-green\)\);\s*color: rgb\(var\(--c-page\)\)/.test(CSS));
  check('with a soft shadow',
    /\.trp-pill \{[\s\S]*?box-shadow: 0 10px 30px/.test(CSS));
  check('under the lightbox, the toast and the menu at 150',
    /\.trp-pills \{[\s\S]*?z-index: 150/.test(CSS));
  check('an icon-only circle under 640px',
    /@media \(max-width: 639px\) \{[\s\S]*?\.trp-pill \{ height: 44px; \}[\s\S]*?\.trp-pill\.is-feedback \{ width: 44px; padding: 0; gap: 0; \}[\s\S]*?\.trp-pill\.is-feedback \.trp-pill-text \{ display: none/.test(CSS));
  check('no hard-coded colour anywhere in its rules',
    !/\.trp-pill[^{]*\{[^}]*#[0-9a-fA-F]{3,6}/.test(CSS));

  check('it is there as soon as the page is drawn, not on a timer',
    pill.hidden === false && pill.classList.contains('is-shown') &&
    !/letIn = true;[\s\S]*?\}, 2000\)/.test(CHROME),
    [pill.hidden, pill.className]);
  check('fading up over 250ms, and never moving again',
    /\.trp-pill \{[\s\S]*?transition: opacity 250ms/.test(CSS) &&
    /\.trp-pill\.is-shown:hover \{ transform: translateY\(-1px\)/.test(CSS));
  check('the main content leaves room so nothing ends under it',
    /html\.trp-has-pill main \{ padding-bottom: 72px/.test(CSS) &&
    doc.documentElement.classList.contains('trp-has-pill'));
  dom.window.close();
}

console.log('\nthe pill steps aside rather than covering anything');
{
  const dom = await openPage('curriculum.html');
  const doc = dom.window.document;
  const api = dom.window.TRFeedbackPill;
  const pill = api.el;
  check('it is showing to begin with', !pill.classList.contains('is-away'));

  api.setFooterInView(true);
  check('the footer coming into view keeps it on screen and clickable', !pill.classList.contains('is-away'));
  check('and lifts the row above the footer',
    api.row.style.getPropertyValue('--trp-pill-lift') !== '');
  api.setFooterInView(false);
  check('back to its place when the footer goes',
    api.row.style.getPropertyValue('--trp-pill-lift') === '0px');

  const lb = doc.createElement('div');
  lb.className = 'trp-cw-lb';
  doc.body.appendChild(lb);
  api.refresh();
  check('the video lightbox puts it away', pill.classList.contains('is-away'));
  lb.remove();
  api.refresh();

  const menu = doc.getElementById('mobile-menu');
  menu.classList.remove('-translate-x-full');
  api.refresh();
  check('the mobile menu puts it away', pill.classList.contains('is-away'));
  menu.classList.add('-translate-x-full');
  api.refresh();

  const toast = doc.createElement('div');
  toast.className = 'trp-toast';
  toast.setAttribute('data-show', '');
  doc.body.appendChild(toast);
  api.refresh();
  check('a toast puts it away', pill.classList.contains('is-away'));
  toast.remove();
  api.refresh();
  check('and with all of them gone it is back', !pill.classList.contains('is-away'));

  api.open();
  check('its own panel puts it away', pill.classList.contains('is-away'));
  api.close();
  check('closing brings it back', !pill.classList.contains('is-away'));
  dom.window.close();
}

/* ---- the panel --------------------------------------------------------- */

console.log('\nthe panel is a dialog, and the page behind it holds still');
{
  const dom = await openPage('curriculum.html');
  fakeLayout(dom.window);
  const doc = dom.window.document;
  const api = dom.window.TRFeedbackPill;
  const panel = doc.querySelector('[data-feedback-panel]');

  check('it is marked as a modal dialog',
    panel.getAttribute('role') === 'dialog' &&
    panel.getAttribute('aria-modal') === 'true' &&
    panel.getAttribute('aria-labelledby') === 'trp-panel-title');
  check('named by its own heading',
    doc.getElementById('trp-panel-title').textContent === "Tell us how it's going");
  check('it has a close button', panel.querySelector('[data-feedback-close]') !== null);
  check('440px on a laptop, full screen on a phone',
    /\.trp-panel \{[\s\S]*?width: 100%; max-width: 440px/.test(CSS));
  check('sliding in from the right over 280ms',
    /\.trp-panel \{ transform: translateX\(100%\); transition: transform 280ms ease-out/.test(CSS));
  check('over a light dim', /\.trp-panel-dim \{[\s\S]*?background: rgb\(0 0 0 \/ \.3\)/.test(CSS));

  // The scroll lock is the menu's, not a second one.
  dom.window.scrollTo(0, 400);
  Object.defineProperty(dom.window, 'pageYOffset', { configurable: true, value: 400 });
  api.open();
  check('opening it locks the page', doc.body.style.position === 'fixed', doc.body.style.position);
  check('at the offset it was at', doc.body.style.top === '-400px', doc.body.style.top);
  check('the form is built into it, not copied',
    panel.querySelector('[data-feedback-form]') !== null &&
    (CHROME.match(/buildFeedback\(/g) || []).length >= 3);
  api.close();
  check('closing unlocks it', doc.body.style.position === '');
  check('and the lock is the one mountMenu uses',
    /function lockScroll/.test(CHROME) && /if \(open\) lockScroll\(\);/.test(CHROME));
  dom.window.close();
}

console.log('\nit closes on the X, Esc and the dim, and asks first if anything was typed');
{
  const dom = await openPage('curriculum.html');
  fakeLayout(dom.window);
  const doc = dom.window.document;
  const api = dom.window.TRFeedbackPill;
  const confirmBox = doc.querySelector('[data-feedback-confirm]');

  // Nothing typed: it just closes.
  api.open();
  clickOn(doc, '[data-feedback-close]');
  check('the X closes an untouched panel', !api.isOpen());

  api.open();
  doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Esc closes it', !api.isOpen());

  api.open();
  clickOn(doc, '[data-feedback-dim]');
  check('a tap on the dim closes it', !api.isOpen());

  // Something typed: it asks, inline.
  api.open();
  const email = doc.querySelector('[data-feedback-panel] input[name="Email"]');
  email.value = 'eve@example.com';
  email.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  clickOn(doc, '[data-feedback-close]');
  check('with something typed it asks first', api.isOpen() && confirmBox.hidden === false);
  check('and it asks on the page, not in a browser dialog',
    /Close without sending\?/.test(confirmBox.textContent) &&
    !/window\.confirm|\bconfirm\(/.test(CHROME), confirmBox.textContent);
  clickOn(doc, '[data-feedback-confirm-no]');
  check('Keep writing puts the question away and stays open',
    api.isOpen() && confirmBox.hidden === true);
  clickOn(doc, '[data-feedback-close]');
  clickOn(doc, '[data-feedback-confirm-yes]');
  check('Close closes it', !api.isOpen());
  dom.window.close();
}

console.log('\nfocus is trapped in the panel and comes back to the pill');
{
  const dom = await openPage('curriculum.html');
  fakeLayout(dom.window);
  const doc = dom.window.document;
  const api = dom.window.TRFeedbackPill;

  api.open();
  check('focus starts on the first field',
    doc.activeElement === doc.querySelector('[data-feedback-panel] input[name="Email"]'),
    doc.activeElement && doc.activeElement.name);

  const able = [...api.panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea, select')];
  const last = able[able.length - 1];
  last.focus();
  doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  check('Tab off the end wraps to the start', doc.activeElement === able[0],
    doc.activeElement && doc.activeElement.className);
  able[0].focus();
  doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
  check('and Shift+Tab off the start wraps to the end', doc.activeElement === last);

  api.close();
  check('closing returns focus to the pill', doc.activeElement === api.el,
    doc.activeElement && doc.activeElement.className);
  dom.window.close();
}

console.log('\na submit from the panel posts the same fields as the page');
{
  const dom = await openPage('curriculum.html', { settleMs: 5 });
  fakeLayout(dom.window);
  const doc = dom.window.document;
  const api = dom.window.TRFeedbackPill;
  api.open();

  const panel = api.panel;
  const email = panel.querySelector('input[name="Email"]');
  email.value = 'eve@example.com';
  email.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  const chip = [...panel.querySelectorAll('.trp-fb-chips input')]
    .find((n) => n.value === '6+ hours');
  chip.checked = true;
  chip.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  panel.querySelector('[data-feedback-next]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  const send = panel.querySelector('[data-feedback-send]');
  send.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  send.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await tick();

  check('one POST from the panel', dom.window.posts.length === 1, dom.window.posts.length);
  const WANT = ['Name', 'Email', 'Built so far', 'Time saved', 'Slowing me down',
    'Would recommend', 'Learn in last sessions', 'Biggest unlock', 'Favorite teachers',
    'How can we improve', 'Founders to invite', 'OK to feature', 'Source', '_gotcha'];
  check('with the same field names as the page',
    JSON.stringify(Object.keys(dom.window.posts[0].body).sort()) === JSON.stringify([...WANT].sort()),
    Object.keys(dom.window.posts[0].body));
  check('and the answer that was tapped',
    dom.window.posts[0].body['Time saved'] === '6+ hours',
    dom.window.posts[0].body['Time saved']);

  // It shows the same thank-you, then closes itself.
  await new Promise((r) => setTimeout(r, 300));
  check('the panel shows the same thank-you',
    panel.querySelector('[data-feedback-thanks]').hidden === false);
  await new Promise((r) => setTimeout(r, 500));
  check('then closes itself', !api.isOpen());
  check('and the pill stays, so more feedback can be sent', api.el.hidden === false);
  check('nothing is remembered that would hide it',
    !/sessionStorage/.test(CHROME));
  // Opening it again starts a fresh form, not the settled thank-you.
  api.open();
  await new Promise((r) => setTimeout(r, 50));
  check('the next open is a fresh form',
    panel.querySelector('[data-feedback-thanks]') === null ||
    panel.querySelector('[data-feedback-thanks]').hidden === true);
  dom.window.close();
}

/* ---- the way in -------------------------------------------------------- */

console.log('\nthe footer still points at the page as well');
{
  for (const name of ['index', 'dashboard', 'curriculum', 'resources', 'prompts', 'members', 'feedback']) {
    check(name + ': the footer carries Give feedback',
      read('club/' + name + '.html')
        .includes('<a href="/club/feedback" class="trp-foot-link">Give feedback</a>'));
  }
  check('and every week still ends by asking',
    /How's it going\? Tell us in 2 minutes/.test(read('club/curriculum.html')));
}

/* ---- the testimonial page ---------------------------------------------- */

/* Ella, 9 Nov: members cannot do the feedback and the video in one sitting,
   so the video testimonial is its own page they can come back to. Same
   shell as the feedback page, no side panel, and the video link is the one
   thing it will not send without. */

const TEST_HTML = read('club/testimonial.html');

console.log('\nthe testimonial page is the same shell as the feedback page');
{
  const doc = new JSDOM(TEST_HTML, { virtualConsole: new VirtualConsole() }).window.document;

  check('the session gate is on it', /<html[^>]*data-trp-gate/.test(TEST_HTML));
  check('and it loads the gate script', TEST_HTML.includes('portal-access.js'));
  check('it loads the chrome that builds the form', TEST_HTML.includes('portal-chrome.js'));
  check('with no form markup of its own', doc.querySelector('form') === null);
  check('one container for the component', doc.querySelectorAll('[data-testimonial-mount]').length === 1);
  check('and not the feedback one', doc.querySelector('[data-feedback-mount]') === null);

  check('one centred column, the same as the feedback page',
    doc.querySelectorAll('.trp-fb-wrap').length === 1 &&
    doc.querySelector('.trp-fb-wrap > .trp-fb-back') !== null);
  check('the back link goes to the course',
    doc.querySelector('.trp-fb-back').getAttribute('href') === 'curriculum' &&
    doc.querySelector('.trp-fb-back').textContent.trim().endsWith('Back to the course'));

  const head = doc.querySelector('.trp-fb-head');
  check('the eyebrow reads Testimonial',
    head.querySelector('.trp-fb-eyebrow').textContent === 'Testimonial');
  check('the h1 is Ella\'s line',
    head.querySelector('h1').textContent.replace(/\s+/g, ' ') === '🏆 Your testimonial: WIN',
    head.querySelector('h1').textContent);
  check('and the line under it names the prize and the date',
    head.querySelector('.trp-fb-lede').textContent ===
    'Do both by Mon 16 Nov to enter the Testimonial Prize (3 winners): a 30-minute strategy call with our mentors.',
    head.querySelector('.trp-fb-lede').textContent);

  check('it is its own canonical address',
    TEST_HTML.includes('<link rel="canonical" href="https://timerich.ai/club/testimonial" />') &&
    !TEST_HTML.includes('timerich.ai/club/feedback'));
  check('with its own title', /<title>Your testimonial \| Time Rich Club<\/title>/.test(TEST_HTML));
  check('and the theme control has an id of its own, not the feedback page\'s',
    TEST_HTML.includes('id="theme-testimonial"') && !TEST_HTML.includes('theme-feedback'));
  check('the footer is the Club footer',
    TEST_HTML.includes('<a href="/club/feedback" class="trp-foot-link">Give feedback</a>'));
  check('and the prefetch rules already cover a new /club page',
    /"href_matches": "\/club\/:page"/.test(TEST_HTML));
}

console.log('\nthe testimonial form asks for the recommendation, then the video');
{
  const dom = await openPage('testimonial.html');
  const doc = dom.window.document;
  const form = doc.querySelector('[data-testimonial-form]');
  check('the form is built into the page', form !== null);
  check('and it is not the two-step feedback form',
    doc.querySelector('[data-feedback-form]') === null &&
    doc.querySelector('.trp-fb-steps') === null);

  check('email is first, and required',
    form.querySelector('input[name="Email"]') !== null &&
    form.querySelector('input[name="Email"]').required === true);
  check('with the same helper line as the feedback form',
    /So we can thank you, and reach you about the Testimonial Prize\./
      .test(form.textContent.replace(/\s+/g, ' ')));

  const tiles = [...form.querySelectorAll('.trp-fb-tile')];
  check('two numbered tiles', tiles.length === 2, tiles.length);

  const one = tiles[0].textContent.replace(/\s+/g, ' ');
  check('the first is the recommendation, with Ella\'s own words',
    /1\. Recommend Ella on LinkedIn/.test(one) &&
    /On her profile, click More, then Recommend\./.test(one), one);
  const ella = tiles[0].querySelector('a');
  check('a secondary button opens her profile in a new tab',
    ella.getAttribute('href') === 'https://www.linkedin.com/in/ellamolonycook/' &&
    ella.getAttribute('target') === '_blank' && /noopener/.test(ella.getAttribute('rel')) &&
    ella.classList.contains('is-soft') && /Open Ella’s LinkedIn ↗/.test(ella.textContent),
    [ella.getAttribute('href'), ella.textContent]);
  check('and the switch from the old step 2 is reused',
    tiles[0].querySelector('[data-feedback-rec]') !== null &&
    tiles[0].querySelector('.trp-fb-switch .trp-fb-track') !== null &&
    /I’ve done it/.test(one));

  const two = tiles[1].textContent.replace(/\s+/g, ' ');
  check('the second asks for a 1 to 2 minute video',
    /2\. Send us a 1 to 2 minute video/.test(two) && /Hit these points:/.test(two), two);
  const points = [...tiles[1].querySelectorAll('.trp-fb-points li')].map((l) => l.textContent);
  check('with Ella\'s five points, in order',
    points.join('|') === ['Who you are (30 seconds)', 'Your biggest takeaway',
      'Your outcome: what you built or changed', 'Your mindset shift',
      'Why you’d tell a founder to join, and what the community gave you'].join('|'),
    points);

  const video = form.querySelector('[name="Video link"]');
  check('the video link field is there and required',
    video !== null && video.required === true);
  check('labelled for the four places a video can live',
    doc.querySelector('label[for="' + video.id + '"]').textContent ===
    'Paste your video link (Loom, Google Drive, YouTube or Vimeo)',
    doc.querySelector('label[for="' + video.id + '"]').textContent);
  check('with the Google Drive sharing note',
    /Google Drive: set sharing to Anyone with the link\./.test(two), two);

  const post = form.querySelector('[name="LinkedIn video post"]');
  check('the LinkedIn post is a second, optional field', post !== null);
  check('and says so', /Posted it on LinkedIn too\? Paste the link \(optional\)/.test(two), two);

  check('one checkbox, unticked, about sharing the testimonial',
    form.querySelector('[data-feedback-feature]').checked === false &&
    /Time Rich can share my testimonial/.test(form.textContent.replace(/\s+/g, ' ')));
  check('and a single Send it button',
    form.querySelectorAll('[data-feedback-send]').length === 1 &&
    form.querySelector('[data-feedback-send]').textContent === 'Send it');
  check('no file upload box in this round: links only',
    form.querySelector('input[type="file"]') === null);

  const vip = doc.querySelector('[data-testimonial-vip]').textContent.replace(/\s+/g, ' ');
  check('the VIP prize sits under the form',
    vip === 'Posting about the Accelerator every week too? That’s the Stanley VIP Prize: ' +
      'a $1K Stanley setup and 12 months of Wispr Flow.', vip);
  const vipLinks = [...doc.querySelector('[data-testimonial-vip]').querySelectorAll('a')];
  check('with Stanley and Wispr Flow both linked',
    vipLinks.map((a) => a.getAttribute('href')).join('|') ===
    'https://x.getstanley.ai/r/mz4y9g|https://wisprflow.ai/info/redeem-promo?code=TIMERICH6&months=6',
    vipLinks.map((a) => a.getAttribute('href')));
  dom.window.close();
}

console.log('\nthe video link is checked before it is sent');
{
  const dom = await openPage('testimonial.html');
  const doc = dom.window.document;
  const form = doc.querySelector('[data-testimonial-form]');
  const email = form.querySelector('input[name="Email"]');
  const video = form.querySelector('[name="Video link"]');
  const err = doc.querySelector('[data-testimonial-video-error]');
  email.value = 'eve@example.com';
  email.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

  // Nothing pasted: it will not send, and says why.
  clickOn(doc, '[data-feedback-send]');
  await tick();
  check('with no video it does not post', dom.window.posts.length === 0, dom.window.posts.length);
  check('and the message is the Worker\'s own wording',
    err.hidden === false &&
    err.textContent === 'Please paste a Loom, Google Drive, YouTube or Vimeo link.',
    err.textContent);
  check('the field is marked invalid', video.getAttribute('aria-invalid') === 'true');

  for (const bad of ['https://example.com/video.mp4', 'https://loom.com.evil.test/share/a',
                     'http://www.loom.com/share/a', 'dropbox.com/s/a']) {
    video.value = bad;
    video.dispatchEvent(new dom.window.FocusEvent('blur'));
    check('"' + bad.slice(0, 30) + '" is refused inline', err.hidden === false, err.textContent);
  }
  for (const ok of ['https://www.loom.com/share/abc', 'https://drive.google.com/file/d/a/view',
                    'https://youtu.be/abc', 'https://vimeo.com/1', 'https://www.youtube.com/watch?v=a']) {
    video.value = ok;
    video.dispatchEvent(new dom.window.FocusEvent('blur'));
    check('"' + ok.slice(0, 32) + '" is accepted', err.hidden === true, err.textContent);
  }
  check('the page holds the same hosts the Worker does',
    ['loom.com', 'drive.google.com', 'docs.google.com', 'youtube.com', 'youtu.be',
     'vimeo.com', 'linkedin.com'].every((h) => CHROME.includes("'" + h + "'") &&
       read('worker/src/index.js').includes('"' + h + '"')));

  // The LinkedIn post is optional, but a link that is not LinkedIn is refused.
  const post = form.querySelector('[name="LinkedIn video post"]');
  const postErr = doc.querySelector('[data-feedback-video-error]');
  post.value = 'https://example.com/post';
  post.dispatchEvent(new dom.window.FocusEvent('blur'));
  check('a non-LinkedIn post link is refused inline',
    postErr.hidden === false && /linkedin\.com\/posts/.test(postErr.textContent), postErr.textContent);
  post.value = '';
  post.dispatchEvent(new dom.window.FocusEvent('blur'));
  check('and leaving it empty is fine', postErr.hidden === true);
  dom.window.close();
}

console.log('\nthe testimonial posts the names the Worker expects');
{
  const dom = await openPage('testimonial.html', { settleMs: 400 });
  const doc = dom.window.document;
  const form = doc.querySelector('[data-testimonial-form]');
  const email = form.querySelector('input[name="Email"]');
  email.value = 'eve@example.com';
  email.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  form.querySelector('[data-feedback-rec]').checked = true;
  form.querySelector('[name="Video link"]').value = 'https://www.loom.com/share/abc123';
  form.querySelector('[name="LinkedIn video post"]').value = 'https://www.linkedin.com/posts/eve_123';
  form.querySelector('[data-feedback-feature]').checked = true;

  const send = doc.querySelector('[data-feedback-send]');
  send.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  send.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await tick();

  check('one POST, not two', dom.window.posts.length === 1, dom.window.posts.length);
  check('to the same /feedback route',
    dom.window.posts[0].url === 'https://time-rich-forms.timerich.workers.dev/feedback',
    dom.window.posts[0].url);
  const body = dom.window.posts[0].body;
  const WANT = ['Name', 'Email', 'LinkedIn recommendation', 'Video link',
    'LinkedIn video post', 'OK to feature', 'Source', '_gotcha'];
  check('exactly the expected field names',
    JSON.stringify(Object.keys(body).sort()) === JSON.stringify([...WANT].sort()),
    Object.keys(body));
  check('the name came off the session', body.Name === 'Eve', body.Name);
  check('the switch on sends Done', body['LinkedIn recommendation'] === 'Done');
  check('the video link is carried', body['Video link'] === 'https://www.loom.com/share/abc123');
  check('the checkbox ticked sends Yes', body['OK to feature'] === 'Yes');
  check('and Source is club-testimonial', body.Source === 'club-testimonial', body.Source);
  check('none of the feedback form\'s fields come with it',
    !('Built so far' in body) && !('Founders to invite' in body) && !('Rating' in body));

  // The thank-you is the same component, with Ella's line.
  await new Promise((r) => setTimeout(r, 260));
  const thanks = doc.querySelector('[data-feedback-thanks]');
  check('the same thank-you card is shown',
    thanks.hidden === false && thanks.querySelector('.trp-fb-thanks-ring svg') !== null &&
    thanks.getAttribute('role') === 'status');
  check('reading "You\'re in the draw. Thank you!!"',
    /You’re in the draw\. Thank you!!/.test(thanks.textContent), thanks.textContent);
  await new Promise((r) => setTimeout(r, 450));
  check('then settling with a way back to the course',
    thanks.querySelector('[data-feedback-done]') !== null &&
    thanks.querySelector('[data-feedback-done]').getAttribute('href') === '/club/curriculum');
  dom.window.close();
}

console.log('\nan untouched switch and box send the other values');
{
  const dom = await openPage('testimonial.html');
  const doc = dom.window.document;
  const form = doc.querySelector('[data-testimonial-form]');
  const email = form.querySelector('input[name="Email"]');
  email.value = 'eve@example.com';
  email.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  form.querySelector('[name="Video link"]').value = 'https://vimeo.com/123456';
  clickOn(doc, '[data-feedback-send]');
  await tick();
  const body = dom.window.posts[0].body;
  check('an untouched switch sends Not yet', body['LinkedIn recommendation'] === 'Not yet');
  check('and an unticked box sends No', body['OK to feature'] === 'No');
  check('an empty LinkedIn post is sent empty, not missing',
    body['LinkedIn video post'] === '');
  dom.window.close();
}

console.log('\nthe email is still required here');
{
  const dom = await openPage('testimonial.html');
  const doc = dom.window.document;
  const form = doc.querySelector('[data-testimonial-form]');
  form.querySelector('[name="Video link"]').value = 'https://vimeo.com/123456';
  clickOn(doc, '[data-feedback-send]');
  await tick();
  check('with no email it does not post', dom.window.posts.length === 0, dom.window.posts.length);
  const err = doc.querySelector('[data-feedback-error]');
  check('and it asks for one', err.hidden === false && /email/i.test(err.textContent),
    err.textContent);
  dom.window.close();
}

console.log('\nthe testimonial pill is on every Club page, beside the feedback one');
{
  for (const page of ['index.html', 'dashboard.html', 'curriculum.html',
                      'resources.html', 'prompts.html', 'members.html']) {
    const dom = await openPage(page);
    const win = dom.window.document.querySelector('[data-testimonial-pill]');
    check(page + ': the testimonial pill is built', win !== null);
    dom.window.close();
  }

  const onPage = await openPage('testimonial.html');
  check('testimonial.html: no pill, the page is the form',
    onPage.window.document.querySelector('[data-testimonial-pill]') === null &&
    onPage.window.document.querySelector('[data-feedback-pill]') === null);
  onPage.window.close();

  const dom = await openPage('curriculum.html');
  const doc = dom.window.document;
  const win = doc.querySelector('[data-testimonial-pill]');
  check('it is a link to the testimonial page, not a button',
    win.tagName === 'A' && win.getAttribute('href') === '/club/testimonial',
    [win.tagName, win.getAttribute('href')]);
  check('reading 🏆 Submit testimonial & win on a laptop',
    win.querySelector('.trp-pill-emoji').textContent === '🏆' &&
    win.querySelector('.trp-pill-text').textContent === 'Submit testimonial & win',
    win.textContent);
  check('with 🏆 Testimonial standing in on a phone',
    win.querySelector('.trp-pill-short').textContent === 'Testimonial',
    win.textContent);
  check('and one accessible name whichever is showing',
    win.getAttribute('aria-label') === 'Submit your video testimonial and win',
    win.getAttribute('aria-label'));
  check('it wears the same pill styling', win.classList.contains('trp-pill'));

  // Side by side in one row, not stacked.
  const row = doc.querySelector('[data-feedback-pills]');
  const fbPill = doc.querySelector('[data-feedback-pill]');
  check('both pills are in one row', row !== null &&
    win.parentNode === row && fbPill.parentNode === row);
  check('the testimonial pill first, feedback nearest the corner',
    [...row.children].map((c) => (c.getAttribute('data-testimonial-pill') === null
      ? 'feedback' : 'win')).join('|') === 'win|feedback',
    [...row.children].map((c) => c.className));
  check('laid out as a row with a gap, right at the bottom corner',
    /\.trp-pills \{[\s\S]*?display: flex; align-items: center; gap: 10px/.test(CSS));
  check('nothing positions the pills themselves any more',
    !/\.trp-pill \{[^}]*position: fixed/.test(CSS) &&
    !/is-second/.test(CSS) && !/is-second/.test(CHROME));
  check('so both are the same height, 40px on a laptop and 44px on a phone',
    /\.trp-pill \{[\s\S]*?height: 40px/.test(CSS) &&
    /@media \(max-width: 639px\) \{[\s\S]*?\.trp-pill \{ height: 44px; \}/.test(CSS));
  check('the long label gives way to the short one under 640px',
    /@media \(max-width: 639px\) \{[\s\S]*?\.trp-pill\.is-win \.trp-pill-text \{ display: none; \}\s*\.trp-pill\.is-win \.trp-pill-short \{ display: inline; \}/.test(CSS));
  check('and only one of the two is ever in the pill',
    /\.trp-pill-short \{ display: none; \}/.test(CSS));
  check('so the testimonial pill keeps a word on a phone, unlike feedback',
    !/\.trp-pill\.is-win \{ width: 44px/.test(CSS));
  check('the emoji is never hidden, so the circle still says something',
    !/\.trp-pill-emoji \{[^}]*display: none/.test(CSS));
  check('and the page leaves room for the row',
    /html\.trp-has-pill main \{ padding-bottom: 72px/.test(CSS) &&
    doc.documentElement.classList.contains('trp-has-pill'));

  // Both come in together and go away together.
  const api = dom.window.TRFeedbackPill;
  check('both are showing once they are let in',
    !api.el.classList.contains('is-away') && !win.classList.contains('is-away') &&
    win.hidden === false);
  const menu = doc.getElementById('mobile-menu');
  menu.classList.remove('-translate-x-full');
  api.refresh();
  check('the mobile menu puts both away',
    api.el.classList.contains('is-away') && win.classList.contains('is-away'));
  check('and hides them from a screen reader too',
    win.getAttribute('aria-hidden') === 'true');
  menu.classList.add('-translate-x-full');
  api.refresh();
  check('and brings both back',
    !api.el.classList.contains('is-away') && !win.classList.contains('is-away'));
  api.setFooterInView(true);
  check('the footer lifts the row, so both move together',
    api.row.style.getPropertyValue('--trp-pill-lift') !== '' &&
    win.style.getPropertyValue('--trp-pill-lift') === '' &&
    api.el.style.getPropertyValue('--trp-pill-lift') === '',
    api.row.style.getPropertyValue('--trp-pill-lift'));
  dom.window.close();
}

console.log('\nthe feedback pill and the end-of-week ask are switched back on');
{
  check('the chrome has the feedback pill on',
    /var FEEDBACK_ON = true;/.test(CHROME));
  check('and so does the curriculum, for the ask at the foot of the week',
    /var FEEDBACK_ON = true;/.test(read('club/curriculum.html')));
  check('nothing hides the footer link any more',
    !/display:none!important/.test(CHROME) ||
    !/trp-foot-link\[href="\/club\/feedback"\]\{display:none/.test(
      CHROME.slice(CHROME.indexOf('var FEEDBACK_ON = true'),
                   CHROME.indexOf('function mountFeedbackPill'))
        .replace(/if \(!FEEDBACK_ON\) \{[\s\S]*?\}/, '')));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
