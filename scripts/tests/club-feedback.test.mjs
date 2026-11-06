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

console.log('\nthe component mounts on the page, in two steps');
{
  const dom = await openPage('feedback.html');
  const doc = dom.window.document;
  const form = doc.querySelector('[data-feedback-form]');
  check('the form is built into the page', form !== null);

  const steps = [...doc.querySelectorAll('.trp-fb-step')];
  check('there is a two-step indicator', steps.length === 2, steps.length);
  check('reading Feedback then Testimonial',
    steps.map((s) => s.textContent).join('|') === '1Feedback|2Testimonial',
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

  // Step 1's shape.
  check('email is first, and slim', form.querySelector('input[name="Email"]') !== null);
  const chips = [...form.querySelectorAll('input[name="Rating"]')];
  check('ten rating chips, 1 to 10',
    chips.length === 10 && chips.map((c) => c.value).join(',') === '1,2,3,4,5,6,7,8,9,10',
    chips.map((c) => c.value));
  check('they fill the row in ten equal columns',
    /\.trp-fb-scale \{[^}]*grid-template-columns: repeat\(10, minmax\(0, 1fr\)\)/.test(CSS));
  check('and wrap to two rows of five on a narrow phone',
    /@media \(max-width: 420px\) \{ \.trp-fb-scale \{ grid-template-columns: repeat\(5/.test(CSS));
  check('the chosen chip fills dark green',
    /input:checked \+ \.trp-fb-chip \{[^}]*background: rgb\(var\(--c-green\)\)/.test(CSS));
  const ends = form.querySelector('.trp-fb-ends');
  check('the two ends are captioned under it',
    ends !== null && /1 · not great/.test(ends.textContent) && /10 · brilliant/.test(ends.textContent),
    ends && ends.textContent);

  const two = form.querySelector('.trp-fb-two');
  check('the two short answers are side by side on a laptop',
    two !== null && /@media \(min-width: 640px\) \{ \.trp-fb-two \{ grid-template-columns: repeat\(2/.test(CSS));
  check('and both are textareas that grow as you type',
    two.querySelectorAll('textarea').length === 2 && /function autoGrow/.test(CHROME));
  check('capped around six lines', /line \* 6/.test(CHROME));

  // The field nobody needed is gone.
  check('the "Link to it" field is gone',
    form.querySelector('[name="LinkedIn recommendation link"]') === null);
  check('and nothing on the page mentions it',
    !/LinkedIn recommendation link/.test(HTML) && !/LinkedIn recommendation link/.test(CHROME));
  dom.window.close();
}

/* ---- step 1 to step 2 to sent ------------------------------------------ */

function fill(doc, { email = 'eve@example.com', rating = '9', useful, change } = {}) {
  const form = doc.querySelector('[data-feedback-form]');
  const set = (node, value) => {
    node.value = value;
    node.dispatchEvent(new doc.defaultView.Event('input', { bubbles: true }));
  };
  if (email !== null) set(form.querySelector('input[name="Email"]'), email);
  if (rating !== null) {
    const chip = form.querySelector('input[name="Rating"][value="' + rating + '"]');
    chip.checked = true;
    chip.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true }));
  }
  if (useful) set(form.querySelector('textarea[name="Most useful"]'), useful);
  if (change) set(form.querySelector('textarea[name="One thing to change"]'), change);
  return form;
}
const clickOn = (doc, sel) => {
  const node = doc.querySelector(sel);
  node.dispatchEvent(new doc.defaultView.MouseEvent('click', { bubbles: true }));
  return node;
};

console.log('\nNext is blocked until there is an email and a rating');
{
  const dom = await openPage('feedback.html');
  const doc = dom.window.document;
  const next = doc.querySelector('[data-feedback-next]');

  check('Next starts unavailable', next.getAttribute('aria-disabled') === 'true');
  clickOn(doc, '[data-feedback-next]');
  check('tapping it early does not advance',
    doc.querySelector('[data-feedback-step="2"]').hidden === true);
  const hint = doc.querySelector('[data-feedback-step="1"] .trp-fb-msg');
  check('and a hint says why', hint.hidden === false && /email/i.test(hint.textContent),
    hint.textContent);

  // Email only: still blocked, and the hint now names the rating.
  fill(doc, { rating: null });
  check('with just an email it is still unavailable',
    next.getAttribute('aria-disabled') === 'true');
  clickOn(doc, '[data-feedback-next]');
  check('still on step 1', doc.querySelector('[data-feedback-step="2"]').hidden === true);
  check('and the hint asks for the number', /1 to 10/.test(hint.textContent), hint.textContent);

  // Rating too: now it goes.
  fill(doc);
  check('with both, Next becomes available', next.getAttribute('aria-disabled') === 'false');
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

console.log('\nstep 2 is the testimonial, and it is optional');
{
  const dom = await openPage('feedback.html');
  const doc = dom.window.document;
  fill(doc);
  clickOn(doc, '[data-feedback-next]');
  const step2 = doc.querySelector('[data-feedback-step="2"]');
  const text = step2.textContent.replace(/\s+/g, ' ');

  check('a slim prize banner is at the top',
    /Do both to enter the Testimonial Prize: a 30-minute strategy call with our mentors\./.test(text));
  const tiles = [...step2.querySelectorAll('.trp-fb-tile')];
  check('two tiles', tiles.length === 2, tiles.length);
  check('side by side on a laptop, stacked on a phone, equal height',
    /@media \(min-width: 640px\) \{ \.trp-fb-tiles \{ grid-template-columns: repeat\(2/.test(CSS) &&
    /\.trp-fb-tile \{[^}]*height: 100%/.test(CSS));

  check('the written tile is Recommend Ella',
    tiles[0].textContent.includes('Recommend Ella') &&
    tiles[0].textContent.includes('On her profile: More, then Recommend.'));
  const ella = tiles[0].querySelector('a');
  check('with a secondary button to her profile, in a new tab',
    ella.getAttribute('href') === 'https://www.linkedin.com/in/ellamolonycook/' &&
    ella.getAttribute('target') === '_blank' && /noopener/.test(ella.getAttribute('rel')) &&
    ella.classList.contains('is-soft'),
    [ella.getAttribute('href'), ella.className]);
  check('and a toggle that says "I\'ve done it"',
    tiles[0].querySelector('[data-feedback-rec]') !== null &&
    tiles[0].textContent.includes("I've done it"));

  check('the video tile is Post a video',
    tiles[1].textContent.includes('Post a video') &&
    tiles[1].textContent.includes('30 to 60 seconds on LinkedIn about what you’ve built.') &&
    tiles[1].textContent.includes('Tag Ella Molony Cook and use #trcsuperhuman.'));
  check('with one field for the post link',
    tiles[1].querySelector('[name="LinkedIn video post"]') !== null);

  check('one checkbox under the tiles, unticked',
    doc.querySelector('[data-feedback-feature]').checked === false &&
    text.includes('Time Rich can share my feedback and testimonial'));

  check('the footer has Back on the left',
    step2.querySelector('[data-feedback-back]') !== null);
  check('and Skip plus Send it on the right',
    step2.querySelector('.trp-fb-foot-right [data-feedback-skip]') !== null &&
    step2.querySelector('.trp-fb-foot-right [data-feedback-send]') !== null);
  check('Skip reads as Ella wrote it',
    step2.querySelector('[data-feedback-skip]').textContent === 'Skip, just send my feedback');

  // The LinkedIn check, inline under the field.
  const video = tiles[1].querySelector('[name="LinkedIn video post"]');
  video.value = 'https://example.com/post';
  video.dispatchEvent(new dom.window.FocusEvent('blur'));
  const vErr = doc.querySelector('[data-feedback-video-error]');
  check('a link that is not LinkedIn is refused inline',
    vErr.hidden === false && /linkedin\.com\/posts/.test(vErr.textContent), vErr.textContent);
  check('and the field is marked invalid', video.getAttribute('aria-invalid') === 'true');
  video.value = 'https://www.linkedin.com/posts/eve_123';
  video.dispatchEvent(new dom.window.FocusEvent('blur'));
  check('a LinkedIn link clears it', vErr.hidden === true);
  check('it is the same check the draw uses',
    CHROME.includes('/linkedin\\.com\\/./i') &&
    read('contentworkshop/index.html').includes('/linkedin\\.com\\/./i'));
  dom.window.close();
}

console.log('\nSend posts once, with the names the Worker expects');
{
  const dom = await openPage('feedback.html');
  const doc = dom.window.document;
  fill(doc, { useful: 'The hot seats.', change: 'More prompts.' });
  clickOn(doc, '[data-feedback-next]');

  doc.querySelector('[data-feedback-rec]').checked = true;
  doc.querySelector('[name="LinkedIn video post"]').value = 'https://www.linkedin.com/posts/eve_123';
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
  const WANT = ['Name', 'Email', 'Rating', 'Most useful', 'One thing to change',
    'LinkedIn recommendation', 'LinkedIn video post', 'OK to feature', 'Source', '_gotcha'];
  check('exactly the expected field names',
    JSON.stringify(Object.keys(body).sort()) === JSON.stringify([...WANT].sort()),
    Object.keys(body));
  check('and "LinkedIn recommendation link" is not among them',
    !('LinkedIn recommendation link' in body));
  check('the name came off the session', body.Name === 'Eve', body.Name);
  check('the answers are carried', body.Email === 'eve@example.com' && body.Rating === '9' &&
    body['Most useful'] === 'The hot seats.' && body['One thing to change'] === 'More prompts.',
    body);
  check('the toggle on sends Done', body['LinkedIn recommendation'] === 'Done');
  check('the checkbox ticked sends Yes', body['OK to feature'] === 'Yes');
  check('and Source is club-feedback', body.Source === 'club-feedback');

  check('the button said it was sending', /Sending/.test(send.textContent) ||
    doc.querySelector('[data-feedback-thanks]').hidden === false, send.textContent);
  dom.window.close();
}

console.log('\nthe toggle off and the box unticked send the other value');
{
  const dom = await openPage('feedback.html');
  const doc = dom.window.document;
  fill(doc);
  clickOn(doc, '[data-feedback-next]');
  clickOn(doc, '[data-feedback-send]');
  await tick();
  const body = dom.window.posts[0].body;
  check('an untouched toggle sends Not yet', body['LinkedIn recommendation'] === 'Not yet', body['LinkedIn recommendation']);
  check('and an unticked box sends No', body['OK to feature'] === 'No', body['OK to feature']);
  dom.window.close();
}

console.log('\n"Skip, just send my feedback" posts once too');
{
  const dom = await openPage('feedback.html');
  const doc = dom.window.document;
  fill(doc);
  clickOn(doc, '[data-feedback-next]');
  const skip = doc.querySelector('[data-feedback-skip]');
  skip.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  skip.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await tick();
  check('one POST', dom.window.posts.length === 1, dom.window.posts.length);
  check('carrying the feedback that was filled in',
    dom.window.posts[0].body.Rating === '9');
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
  doc.querySelector('[data-feedback-rec]').checked = true;
  doc.querySelector('[name="LinkedIn video post"]').value = 'https://www.linkedin.com/posts/eve_123';
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
  check('and because they did both halves, it names the prize',
    thanks.textContent.includes("You're in the running for the Testimonial Prize."),
    thanks.textContent);

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
  check('and the page did not go blank', doc.querySelector('.trp-fb-wrap') !== null);
  dom.window.close();
}

console.log('\nonly one half done gets the other line');
{
  const dom = await openPage('feedback.html', { settleMs: 9999 });
  const doc = dom.window.document;
  fill(doc);
  clickOn(doc, '[data-feedback-next]');
  doc.querySelector('[data-feedback-rec]').checked = true;      // written only
  clickOn(doc, '[data-feedback-send]');
  await new Promise((r) => setTimeout(r, 260));
  const thanks = doc.querySelector('[data-feedback-thanks]');
  check('it thanks them without promising the prize',
    thanks.textContent.includes('This genuinely shapes what we build next.') &&
    !thanks.textContent.includes('Testimonial Prize'), thanks.textContent);
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
  fill(doc, { useful: 'Keep this.' });
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

  check('everything they typed is still in the fields',
    doc.querySelector('input[name="Email"]').value === 'eve@example.com' &&
    doc.querySelector('textarea[name="Most useful"]').value === 'Keep this.' &&
    doc.querySelector('input[name="Rating"][value="9"]').checked === true);
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
    /NO_PILL = \/\\\/club\\\/\(feedback\|signin\)/.test(CHROME),
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
  check('fixed bottom-right, with the safe-area inset',
    /\.trp-pill \{[\s\S]*?position: fixed[\s\S]*?env\(safe-area-inset-right\)[\s\S]*?env\(safe-area-inset-bottom\)/.test(CSS));
  check('40px tall, fully rounded, dark green on off-white',
    /\.trp-pill \{[\s\S]*?height: 40px[\s\S]*?border-radius: 999px[\s\S]*?background: rgb\(var\(--c-green\)\);\s*color: rgb\(var\(--c-page\)\)/.test(CSS));
  check('with a soft shadow',
    /\.trp-pill \{[\s\S]*?box-shadow: 0 10px 30px/.test(CSS));
  check('under the lightbox, the toast and the menu at 150',
    /\.trp-pill \{[\s\S]*?z-index: 150/.test(CSS));
  check('an icon-only circle under 640px',
    /@media \(max-width: 639px\) \{[\s\S]*?width: 44px; height: 44px[\s\S]*?\.trp-pill-text \{ display: none/.test(CSS));
  check('no hard-coded colour anywhere in its rules',
    !/\.trp-pill[^{]*\{[^}]*#[0-9a-fA-F]{3,6}/.test(CSS));

  check('it starts hidden and arrives on a timer',
    /window\.setTimeout\(function \(\) \{[\s\S]*?letIn = true;[\s\S]*?\}, 2000\)/.test(CHROME));
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
  await new Promise((r) => setTimeout(r, 2050));     // let it in
  check('it is showing to begin with', !pill.classList.contains('is-away'));

  api.setFooterInView(true);
  check('the footer coming into view puts it away', pill.classList.contains('is-away'));
  api.setFooterInView(false);
  check('and it comes back when the footer goes', !pill.classList.contains('is-away'));

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
  await new Promise((r) => setTimeout(r, 2050));

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
  await new Promise((r) => setTimeout(r, 2050));
  api.open();

  const panel = api.panel;
  const email = panel.querySelector('input[name="Email"]');
  email.value = 'eve@example.com';
  email.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  const chip = panel.querySelector('input[name="Rating"][value="7"]');
  chip.checked = true;
  chip.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  panel.querySelector('[data-feedback-next]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  const send = panel.querySelector('[data-feedback-send]');
  send.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  send.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await tick();

  check('one POST from the panel', dom.window.posts.length === 1, dom.window.posts.length);
  const WANT = ['Name', 'Email', 'Rating', 'Most useful', 'One thing to change',
    'LinkedIn recommendation', 'LinkedIn video post', 'OK to feature', 'Source', '_gotcha'];
  check('with the same field names as the page',
    JSON.stringify(Object.keys(dom.window.posts[0].body).sort()) === JSON.stringify([...WANT].sort()),
    Object.keys(dom.window.posts[0].body));
  check('and the rating that was picked', dom.window.posts[0].body.Rating === '7');

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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
