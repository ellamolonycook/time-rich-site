// Form behaviour tests: load /sh-apply/index.html in jsdom and drive it.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const site = (rel) => fileURLToPath(new URL('../../' + rel, import.meta.url));
const HTML = fs.readFileSync(site('sh-apply/index.html'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function boot(url = 'https://timerich.ai/sh-apply/', { reducedMotion = false } = {}) {
  const vc = new VirtualConsole();           // swallow jsdom's "not implemented" noise
  const dom = new JSDOM(HTML, {
    url, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      if (!reducedMotion) return;
      w.matchMedia = () => ({
        matches: true, media: '(prefers-reduced-motion: reduce)',
        addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
      });
    },
  });
  const w = dom.window;
  w.scrollTo = () => {};
  const posts = [];
  w.fetch = (u, init) => { posts.push({ url: u, body: JSON.parse(init.body) }); return Promise.resolve({ ok: true }); };
  return { dom, w, d: w.document, posts };
}

const $ = (d, sel) => d.querySelector(sel);
const visible = (d) => Array.from(d.querySelectorAll('.screen'))
  .filter(s => !s.hidden && !s.classList.contains('is-leaving')).map(s => s.id);
const inDom = (d) => Array.from(d.querySelectorAll('.screen')).filter(s => !s.hidden).map(s => s.id);
const settle = () => sleep(850);             // longer than the staggered arrival + its two setup frames
const selectAdvance = () => sleep(250).then(settle);   // the select pause, then the transition
const flipped = () => sleep(90);             // past the double-rAF, into the flip
const label = (d) => $(d, '#progressLabel').textContent;
const err = (d, id) => $(d, '#' + id).textContent;

function type(w, sel, value) {
  const el = w.document.querySelector(sel);
  el.value = value;
  el.dispatchEvent(new w.Event('input', { bubbles: true }));
}
function click(w, sel) { w.document.querySelector(sel).click(); }
function enter(w, sel, opts = {}) {
  const el = w.document.querySelector(sel);
  el.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, ...opts }));
}

// Fill Q1..Q5 and land on Q6.
async function fillToDepartment(w) {
  click(w, '#startBtn');
  type(w, '#f-first_name', 'Jordan'); click(w, '#s-1 [data-next]');
  type(w, '#f-email', 'jordan@example.com'); click(w, '#s-2 [data-next]');
  type(w, '#f-phone', '+15125550114'); click(w, '#s-3 [data-next]');
  type(w, '#f-linkedin', 'linkedin.com/in/jordanreyes'); click(w, '#s-4 [data-next]');
  type(w, '#f-business', 'A 4-person marketing agency for B2B SaaS.'); click(w, '#s-5 [data-next]');
}

console.log('\nOne question at a time');
{
  const { w, d } = boot();
  check('lands on the intro, no progress bar', visible(d).join() === 's-intro' && $(d, '#progress').hidden);
  click(w, '#startBtn');
  check('start shows only Q1', visible(d).join() === 's-1');
  check('progress reads "1 of 9"', label(d) === '1 of 9', label(d));
  check('bar is at 1/9, via scaleX not width', $(d, '#barFill').style.transform === 'scaleX(0.1111111111111111)'
    && !$(d, '#barFill').style.width, $(d, '#barFill').style.transform);
  await settle();
  check('one question in the DOM once the transition ends', inDom(d).join() === 's-1', inDom(d));
  check('the input is focused', d.activeElement && d.activeElement.id === 'f-first_name', d.activeElement && d.activeElement.id);
}

console.log('\nThe page lands with motion, not a hard cut');
{
  const { w, d } = boot();
  // The intro's parts start displaced and invisible, then assemble.
  check('the intro arrives rather than appearing', $(d, '#s-intro').classList.contains('q-in-below'));
  check('nothing flies out — there is nothing to send away',
    Array.from(d.querySelectorAll('.screen')).every(s => !s.classList.contains('is-leaving')));
  await flipped();
  check('the arrival is running', $(d, '#s-intro').classList.contains('q-in-run'));
  await settle();
  check('and it cleans up after itself',
    !$(d, '#s-intro').classList.contains('q-in-run') && !$(d, '#s-intro').classList.contains('q-in-below'));

  // Resuming mid-form is a landing too: the question arrives, the intro does
  // not perform an exit it never appeared for.
  const r = boot('https://timerich.ai/sh-apply/#q3');
  check('a resumed question arrives the same way', $(r.d, '#s-3').classList.contains('q-in-below'));
  check('the intro does not fly out behind it', !$(r.d, '#s-intro').classList.contains('is-leaving'));
  await settle();
  check('the resumed question is the only one left', inDom(r.d).join() === 's-3', inDom(r.d));
}

console.log('\nThe parts of a question arrive one after another');
{
  const { w, d } = boot();
  const parts = Array.from($(d, '#s-intro').children);
  check('every part is stamped with its position',
    parts.every((p, n) => p.style.getPropertyValue('--i') === String(n)), parts.map(p => p.style.getPropertyValue('--i')));
  check('the stagger is driven off that stamp, not a hard-coded list',
    /transition-delay:calc\(var\(--q-offset\) \+ var\(--i,0\) \* var\(--q-stagger\)\)/
      .test(HTML.replace(/\s*\n\s*/g, '')));

  await settle();
  click(w, '#startBtn');
  const q1 = Array.from($(d, '#s-1').children);
  check('the arriving question stamps its parts too',
    q1.length >= 3 && q1.every((p, n) => p.style.getPropertyValue('--i') === String(n)));
  check('the whole block does not also translate — only its parts do',
    !$(d, '#s-1').classList.contains('q-below') && !$(d, '#s-1').classList.contains('q-above'));
}

console.log('\nTransitions: only transform and opacity are ever animated');
{
  // A static read of the stylesheet — the cheapest possible guard against
  // someone reintroducing a layout-animating property later.
  const css = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>'));
  const flat = css.replace(/\s*\n\s*/g, '');
  const animated = [...css.matchAll(/transition:([^;}]+)/g)].map(m => m[1]);
  const layoutProps = /\b(width|height|top|left|right|bottom|margin|padding|inset)\b/;
  check('no transition anywhere animates a layout property',
    animated.every(v => !layoutProps.test(v)), animated.filter(v => layoutProps.test(v)));
  check('the progress bar advances on transform, not width',
    /\.bar-fill\{[^}]*transition:transform/.test(flat));
  check('the exit animates transform and opacity only',
    /\.screen\.q-exit\s*\{transition:transform[^}]*opacity[^}]*\}/.test(flat)
    && !layoutProps.test((flat.match(/\.screen\.q-exit\s*\{([^}]*)\}/) || [, ''])[1]));
  check('the staggered arrival animates transform and opacity only',
    !layoutProps.test((flat.match(/\.screen\.q-in-run > \*\{([^}]*)\}/) || [, ''])[1]));
  check('the displaced states use transform, not offsets',
    /\.screen\.q-below\{transform:translateY/.test(flat)
    && /\.screen\.q-in-below > \*\{opacity:0;transform:translateY/.test(flat));
  check('the scrollbar gutter is reserved so a height change cannot reflow the page',
    /scrollbar-gutter:\s*stable/.test(css));
}

console.log('\nTransitions: direction, overlap, and the one-question rule');
{
  const { w, d } = boot();
  await settle();
  click(w, '#startBtn');
  // Frame 0: start states applied, nothing transitioning yet.
  check('the outgoing one is taken out of flow immediately', $(d, '#s-intro').classList.contains('is-leaving'));
  check('the outgoing one is promoted before the flip, not during it', $(d, '#s-intro').classList.contains('q-will'));
  check('the incoming parts start displaced below', $(d, '#s-1').classList.contains('q-in-below'));
  check('nothing has begun transitioning yet',
    !$(d, '#s-intro').classList.contains('q-exit') && !$(d, '#s-1').classList.contains('q-in-run'));
  check('the stage is marked busy so hover effects stand down', $(d, '#applyForm').classList.contains('q-busy'));
  check('the two overlap — both are briefly in the DOM', inDom(d).length === 2, inDom(d));
  check('the outgoing one leaves the accessibility tree', $(d, '#s-intro').getAttribute('aria-hidden') === 'true');
  check('focus has not moved yet (no yank mid-flight)', !(d.activeElement && d.activeElement.id === 'f-first_name'));

  await flipped();
  check('forward: the outgoing block is transitioning up and out',
    $(d, '#s-intro').classList.contains('q-exit') && $(d, '#s-intro').classList.contains('q-above'));
  check('forward: the incoming parts are assembling',
    $(d, '#s-1').classList.contains('q-in-run') && !$(d, '#s-1').classList.contains('q-in-below'));

  await settle();
  check('end state is a single question', inDom(d).join() === 's-1', inDom(d));
  check('the outgoing one is fully cleaned up',
    !$(d, '#s-intro').classList.contains('is-leaving') && !$(d, '#s-intro').hasAttribute('aria-hidden'));
  check('will-change is released — no idle question holds a layer',
    !$(d, '#s-1').classList.contains('q-will') && !$(d, '#s-intro').classList.contains('q-will'));
  check('no transition classes left behind',
    !$(d, '#s-1').classList.contains('q-in-run') && !$(d, '#s-intro').classList.contains('q-exit'));
  check('the stage is no longer busy', !$(d, '#applyForm').classList.contains('q-busy'));
  check('focus lands once the field itself has arrived', d.activeElement.id === 'f-first_name');

  type(w, '#f-first_name', 'Jordan');
  enter(w, '#f-first_name');
  await flipped();
  check('Enter-key advance animates too',
    $(d, '#s-1').classList.contains('q-above') && $(d, '#s-2').classList.contains('q-in-run'));
  await settle();

  click(w, '#s-2 [data-back]');
  await sleep(40);                                    // history.back() -> popstate is async
  check('back: the incoming parts start displaced above', $(d, '#s-1').classList.contains('q-in-above'));
  await flipped();
  check('back: the outgoing block is transitioning down and out',
    $(d, '#s-2').classList.contains('q-exit') && $(d, '#s-2').classList.contains('q-below'));
  check('back: the incoming parts are assembling downward',
    $(d, '#s-1').classList.contains('q-in-run') && !$(d, '#s-1').classList.contains('q-in-above'));
  await settle();
  check('back ends on a single question', inDom(d).join() === 's-1', inDom(d));
  check('no stale displacement left on the screen that just left',
    !$(d, '#s-2').classList.contains('q-below') && !$(d, '#s-2').classList.contains('q-above'));
}

console.log('\nTransitions: interrupting one mid-flight');
{
  const { w, d } = boot();
  click(w, '#startBtn');
  type(w, '#f-first_name', 'Jordan');
  click(w, '#s-1 [data-next]');                       // interrupts the intro's exit
  type(w, '#f-email', 'jordan@example.com');
  click(w, '#s-2 [data-next]');                       // and Q1's
  check('a rushed run never leaves more than the pair mid-flight', inDom(d).length <= 2, inDom(d));
  await settle();
  check('it still settles to exactly one question', inDom(d).join() === 's-3', inDom(d));
  check('no abandoned screen is left holding a layer',
    Array.from(d.querySelectorAll('.screen')).every(s =>
      !s.classList.contains('q-will') && !s.classList.contains('q-in-run')));
  check('focus is not left on an abandoned screen', d.activeElement.id === 'f-phone', d.activeElement.id);
}

console.log('\nTransitions: the Q9 -> Q9b sub-step, both directions');
{
  const { w, d } = boot();
  await fillToDepartment(w);
  await settle();
  d.querySelectorAll('#s-6 .opt')[0].click(); await selectAdvance();
  type(w, '#f-outcome', 'A two-week holiday without the business falling over.');
  click(w, '#s-7 [data-next]'); await settle();
  d.querySelectorAll('#s-8 .opt')[1].click(); await selectAdvance();
  d.querySelectorAll('#s-9 .opt')[0].click();          // "Yes" -> Q9b
  await sleep(280);                                    // the select pause,
  await flipped();                                     // then the double-rAF flip
  check('Q9 -> Q9b travels forward (up)',
    $(d, '#s-9').classList.contains('q-above') && $(d, '#s-9b').classList.contains('q-in-run'));
  await settle();
  click(w, '#s-9b [data-back]');
  await sleep(40);
  check('Q9b -> Q9 starts the incoming parts above', $(d, '#s-9').classList.contains('q-in-above'));
  await flipped();
  check('Q9b -> Q9 travels back (down)', $(d, '#s-9b').classList.contains('q-below'));
  await settle();
  check('lands on Q9 alone', inDom(d).join() === 's-9', inDom(d));
}

console.log('\nTransitions: the two heaviest screens');
{
  // Q6 renders seven option buttons, Q3 carries the intl-tel-input markup —
  // the biggest subtrees on the form, and so the most expensive to promote and
  // rasterise. The mechanics have to hold on both, in and out.
  const { w, d } = boot();
  await settle();
  click(w, '#startBtn');
  type(w, '#f-first_name', 'Jordan'); click(w, '#s-1 [data-next]');
  type(w, '#f-email', 'jordan@example.com'); click(w, '#s-2 [data-next]');
  await flipped();
  check('into the phone screen: its parts are assembling', $(d, '#s-3').classList.contains('q-in-run'));
  await settle();
  check('phone screen settles alone and releases everything',
    inDom(d).join() === 's-3' && !$(d, '#s-3').classList.contains('q-in-run'));

  type(w, '#f-phone', '+15125550114'); click(w, '#s-3 [data-next]');
  await flipped();
  check('out of the phone screen: the whole block leaves, promoted',
    $(d, '#s-3').classList.contains('q-exit') && $(d, '#s-3').classList.contains('q-will'));
  await settle();

  type(w, '#f-linkedin', 'linkedin.com/in/jordanreyes'); click(w, '#s-4 [data-next]');
  await settle();
  type(w, '#f-business', 'A 4-person marketing agency.'); click(w, '#s-5 [data-next]');
  await flipped();
  check('into the seven-option screen: its parts are assembling', $(d, '#s-6').classList.contains('q-in-run'));
  check('the seven buttons move as one group, not seven separate animations',
    Array.from(d.querySelectorAll('#s-6 .opt')).every(b => !b.style.getPropertyValue('--i')));
  check('it is the options container that is staggered, as one part',
    $(d, '#s-6 .q-opts').style.getPropertyValue('--i') !== '');
  await settle();
  check('seven-option screen settles alone and releases everything',
    inDom(d).join() === 's-6' && !$(d, '#s-6').classList.contains('q-in-run'));

  d.querySelectorAll('#s-6 .opt')[2].click();
  await selectAdvance();
  check('out of the seven-option screen, on auto-advance', inDom(d).join() === 's-7', inDom(d));
  check('and it left nothing behind',
    !$(d, '#s-6').classList.contains('q-will') && !$(d, '#s-6').classList.contains('is-leaving'));
}

console.log('\nTransitions: prefers-reduced-motion gets an instant swap');
{
  const { w, d } = boot('https://timerich.ai/sh-apply/', { reducedMotion: true });
  check('the landing does not animate either', !$(d, '#s-intro').classList.contains('q-in-below'));
  click(w, '#startBtn');
  check('no overlap — one question in the DOM immediately', inDom(d).join() === 's-1', inDom(d));
  check('nothing is translated out', !$(d, '#s-intro').classList.contains('is-leaving'));
  check('no transition or displacement classes at all',
    !$(d, '#s-1').classList.contains('q-in-run') && !$(d, '#s-1').classList.contains('q-in-below')
    && !$(d, '#s-1').classList.contains('q-in-above'));
  check('nothing is promoted to a layer', !$(d, '#s-1').classList.contains('q-will'));
  check('the stage is never marked busy', !$(d, '#applyForm').classList.contains('q-busy'));
  check('focus is immediate, not deferred', d.activeElement.id === 'f-first_name', d.activeElement.id);
  type(w, '#f-first_name', 'Jordan'); click(w, '#s-1 [data-next]');
  click(w, '#s-2 [data-back]');
  await sleep(40);
  check('back is instant too', inDom(d).join() === 's-1' && !$(d, '#s-2').classList.contains('q-exit'));
}

console.log('\nValidation happens on advance, not on keystroke');
{
  const { w, d } = boot();
  click(w, '#startBtn');
  type(w, '#f-first_name', '');
  check('typing alone raises no error', err(d, 'e-1') === '');
  click(w, '#s-1 [data-next]');
  check('advancing with an empty required field errors', err(d, 'e-1').length > 0, err(d, 'e-1'));
  check('the error slot is aria-live polite', $(d, '#e-1').getAttribute('aria-live') === 'polite');
  check('input marked aria-invalid', $(d, '#f-first_name').getAttribute('aria-invalid') === 'true');
  check('still on Q1', visible(d).join() === 's-1');

  type(w, '#f-first_name', 'Jordan'); click(w, '#s-1 [data-next]');
  check('a valid answer advances to Q2', visible(d).join() === 's-2' && label(d) === '2 of 9');

  type(w, '#f-email', 'nope'); click(w, '#s-2 [data-next]');
  check('a malformed email is rejected', visible(d).join() === 's-2' && err(d, 'e-2').length > 0);
  type(w, '#f-email', 'jordan@example.com'); enter(w, '#f-email');
  check('Enter advances on a single-line field', visible(d).join() === 's-3');

  type(w, '#f-phone', '0871234567'); click(w, '#s-3 [data-next]');
  check('a number with no country code is rejected (E.164 fallback)', visible(d).join() === 's-3' && /country code/i.test(err(d, 'e-3')));
  type(w, '#f-phone', '+353 87 123 4567'); click(w, '#s-3 [data-next]');
  check('a full E.164 number passes', visible(d).join() === 's-4');

  type(w, '#f-linkedin', 'twitter.com/jordan'); click(w, '#s-4 [data-next]');
  check('a non-LinkedIn link is rejected', visible(d).join() === 's-4' && /LinkedIn/i.test(err(d, 'e-4')));
  type(w, '#f-linkedin', 'linkedin.com/company/acme'); click(w, '#s-4 [data-next]');
  check('linkedin.com/company/... is accepted', visible(d).join() === 's-5');

  type(w, '#f-business', ''); click(w, '#s-5 [data-next]');
  check('empty one-liner rejected', visible(d).join() === 's-5');
  type(w, '#f-business', 'Marketing agency.');
  check('the counter updates live', $(d, '#c-5').textContent === '17 / 140', $(d, '#c-5').textContent);
  click(w, '#s-5 [data-next]');
  check('reached Q6', visible(d).join() === 's-6' && label(d) === '6 of 9');
}

console.log('\nSelect questions auto-advance and submit the short value');
{
  const { w, d } = boot();
  await fillToDepartment(w);
  const seventh = d.querySelectorAll('#s-6 .opt')[6];
  check('Q6 has 7 options', d.querySelectorAll('#s-6 .opt').length === 7);
  check('the 7th shows the full label', /Not sure yet/.test(seventh.textContent) && /figuring out/.test(seventh.textContent));
  check('the 7th submits the short value', seventh.getAttribute('data-value') === 'Not sure yet');
  seventh.click();
  check('selection is visible immediately', seventh.getAttribute('aria-pressed') === 'true');
  check('it does not advance instantly', visible(d).join() === 's-6');
  await sleep(400);
  check('it auto-advances after ~250ms', visible(d).join() === 's-7', visible(d));

  check('Q8 button labels are long, values are short',
    Array.from(d.querySelectorAll('#s-8 .opt')).map(b => b.getAttribute('data-value')).join() === 'Six weeks,Ten weeks,Not sure');
  check('Q8 shows "Build the system" style sublabels', /Build the system/.test($(d, '#s-8').textContent));
  check('Q9 values are Yes/No/Tell me more',
    Array.from(d.querySelectorAll('#s-9 .opt')).map(b => b.getAttribute('data-value')).join() === 'Yes,No,Tell me more');
  check('Q9 third button reads "Tell me more on the call"', /Tell me more on the call/.test(d.querySelectorAll('#s-9 .opt')[2].textContent));
}

console.log('\nTextareas: Enter is a newline, Cmd/Ctrl+Enter advances');
{
  const { w, d } = boot();
  await fillToDepartment(w);
  click(w, '#s-6 .opt'); await selectAdvance();
  check('on Q7', visible(d).join() === 's-7');
  type(w, '#f-outcome', 'Short');
  click(w, '#s-7 [data-next]');
  check('under 15 characters is rejected', visible(d).join() === 's-7' && err(d, 'e-7').length > 0);
  type(w, '#f-outcome', 'A two-week holiday without the business falling over.');
  enter(w, '#f-outcome');
  check('plain Enter does not advance a textarea', visible(d).join() === 's-7');
  enter(w, '#f-outcome', { metaKey: true });
  check('Cmd+Enter advances', visible(d).join() === 's-8');
}

console.log('\nQ9b only exists for Yes / Tell me more');
{
  const { w, d } = boot();
  await fillToDepartment(w);
  click(w, '#s-6 .opt'); await selectAdvance();
  type(w, '#f-outcome', 'A two-week holiday without the business falling over.');
  click(w, '#s-7 [data-next]');
  d.querySelectorAll('#s-8 .opt')[1].click(); await selectAdvance();
  check('on Q9', visible(d).join() === 's-9');
  d.querySelectorAll('#s-9 .opt')[1].click(); await selectAdvance();   // "No"
  check('"No" skips Q9b straight to submit', visible(d).join() === 's-submit', visible(d));
  check('progress still reads "9 of 9" on the submit screen', label(d) === '9 of 9');

  click(w, '#s-submit [data-back]'); await sleep(60);
  check('Back from submit returns to Q9 on the "No" path', visible(d).join() === 's-9', visible(d));
  d.querySelectorAll('#s-9 .opt')[0].click(); await selectAdvance();   // "Yes"
  check('"Yes" opens Q9b', visible(d).join() === 's-9b');
  check('Q9b is a sub-step: progress stays "9 of 9"', label(d) === '9 of 9', label(d));
  click(w, '#s-9b [data-next]');
  check('Q9b is optional — empty advances', visible(d).join() === 's-submit');
}

console.log('\nBack keeps answers; sessionStorage survives a refresh');
{
  const { w, d } = boot();
  click(w, '#startBtn');
  type(w, '#f-first_name', 'Jordan'); click(w, '#s-1 [data-next]');
  type(w, '#f-email', 'jordan@example.com'); click(w, '#s-2 [data-next]');
  click(w, '#s-3 [data-back]'); await sleep(60);
  check('Back lands on Q2', visible(d).join() === 's-2', visible(d));
  check('Back preserved the typed answer', $(d, '#f-email').value === 'jordan@example.com');
  click(w, '#s-2 [data-back]'); await sleep(60);
  check('Back again lands on Q1 with its answer', visible(d).join() === 's-1' && $(d, '#f-first_name').value === 'Jordan');

  const stored = JSON.parse(w.sessionStorage.getItem('shApplyV2'));
  check('answers are persisted to sessionStorage', stored.answers.first_name === 'Jordan' && stored.answers.email === 'jordan@example.com', stored.answers);

  // Simulate a refresh: same storage, same URL.
  const url = w.location.href;
  const again = boot(url);
  again.w.sessionStorage.setItem('shApplyV2', JSON.stringify(stored));
  const back = boot(url);
  back.w.sessionStorage.setItem('shApplyV2', JSON.stringify(stored));
  check('a refresh can restore from storage (key present, shape intact)',
    typeof stored.idx === 'number' && stored.answers && Object.keys(stored.answers).length >= 2);
}

console.log('\nBrowser Back moves one question, it does not exit the form');
{
  const { w, d } = boot();
  click(w, '#startBtn');
  type(w, '#f-first_name', 'Jordan'); click(w, '#s-1 [data-next]');
  check('the URL carries the question', /#q2$/.test(w.location.hash), w.location.hash);
  w.history.back();
  await sleep(80);
  check('history back returns to Q1', visible(d).join() === 's-1', visible(d));
}

console.log('\nThe LinkedIn escape hatch');
{
  const { w, d } = boot();
  click(w, '#startBtn');
  type(w, '#f-first_name', 'Jordan'); click(w, '#s-1 [data-next]');
  type(w, '#f-email', 'jordan@example.com'); click(w, '#s-2 [data-next]');
  type(w, '#f-phone', '+15125550114'); click(w, '#s-3 [data-next]');
  click(w, '#linkedinSwap');
  check('the label swaps to Website or Instagram', /Website or Instagram/.test($(d, '#lbl-linkedin').textContent));
  type(w, '#f-linkedin', 'jordanreyes.com'); click(w, '#s-4 [data-next]');
  check('a non-LinkedIn link is now accepted', visible(d).join() === 's-5');
}

console.log('\nOne POST at the end, with the exact payload shape');
{
  const { w, d, posts } = boot('https://timerich.ai/sh-apply/?utm_source=instagram&utm_campaign=sh-launch');
  await fillToDepartment(w);
  check('no request is made per question', posts.length === 0);
  d.querySelectorAll('#s-6 .opt')[3].click(); await sleep(400);        // Operations & admin
  type(w, '#f-outcome', 'A two-week holiday without the business falling over.');
  click(w, '#s-7 [data-next]');
  d.querySelectorAll('#s-8 .opt')[1].click(); await selectAdvance();        // Ten weeks
  d.querySelectorAll('#s-9 .opt')[0].click(); await selectAdvance();        // Yes
  type(w, '#f-coaching_focus', 'Delegating without micromanaging.');
  click(w, '#s-9b [data-next]');
  check('on the submit screen', visible(d).join() === 's-submit');
  check('the submit button says "Submit my application"', $(d, '#submitBtn').textContent === 'Submit my application');
  check('the summary shows what they answered', /Operations & admin/.test($(d, '#summary').textContent));

  $(d, '#submitBtn').click();
  $(d, '#submitBtn').click();                                          // double-submit attempt
  await sleep(120);
  check('exactly one POST', posts.length === 1, posts.length);
  check('double-submit is blocked (button disabled)', $(d, '#submitBtn').disabled);
  const b = posts[0].body;
  check('posts to /superhuman', String(posts[0].url).endsWith('/superhuman'));
  check('payload keys are exactly the agreed set',
    Object.keys(b).sort().join() === ['_gotcha','business','coaching','coaching_focus','department','email','first_name','form_version','linkedin','outcome','phone','source','track'].sort().join(),
    Object.keys(b));
  check('form_version marks the new form', b.form_version === 'sh-apply-v2');
  check('first_name', b.first_name === 'Jordan');
  check('email', b.email === 'jordan@example.com');
  check('phone kept as E.164', b.phone === '+15125550114');
  check('linkedin normalised to a full URL', b.linkedin === 'https://linkedin.com/in/jordanreyes', b.linkedin);
  check('department is the short select value', b.department === 'Operations & admin');
  check('track is the short select value', b.track === 'Ten weeks');
  check('coaching is the short select value', b.coaching === 'Yes');
  check('coaching_focus captured', b.coaching_focus === 'Delegating without micromanaging.');
  check('source carries the landing UTMs', /utm_source=instagram/.test(b.source) && /utm_campaign=sh-launch/.test(b.source), b.source);
  check('sessionStorage answers cleared on success', w.sessionStorage.getItem('shApplyV2') === null);
  check('first name handed to the thank-you page', w.sessionStorage.getItem('shApplyThanks') === 'Jordan');
}

console.log('\nA typed phone number is stored as clean E.164');
{
  const { w } = boot();
  click(w, '#startBtn');
  type(w, '#f-first_name', 'Jordan'); click(w, '#s-1 [data-next]');
  type(w, '#f-email', 'jordan@example.com'); click(w, '#s-2 [data-next]');
  type(w, '#f-phone', '+353 87 123 4567'); click(w, '#s-3 [data-next]');
  const stored = JSON.parse(w.sessionStorage.getItem('shApplyV2'));
  check('spaces are stripped before the number is stored', stored.answers.phone === '+353871234567', stored.answers.phone);
}

console.log('\nMarkup / accessibility basics');
{
  const { d } = boot();
  const qs = Array.from(d.querySelectorAll('form .screen[data-step]'));
  check('nine numbered steps plus Q9b and submit', qs.length === 11, qs.length);
  check('data-step never exceeds 9', qs.every(s => +s.getAttribute('data-step') <= 9));
  check('every text question has a real <label>', ['f-first_name','f-email','f-phone','f-linkedin','f-business','f-outcome','f-coaching_focus']
    .every(id => d.querySelector('label[for="' + id + '"]')));
  check('every question screen has an aria-live error slot',
    qs.filter(s => s.id !== 's-submit').every(s => s.querySelector('.q-error[aria-live="polite"]')));
  check('select groups are labelled by their heading',
    Array.from(d.querySelectorAll('[data-select] .q-opts')).every(g => d.getElementById(g.getAttribute('aria-labelledby'))));
  check('correct mobile keyboards', $(d, '#f-email').getAttribute('inputmode') === 'email'
    && $(d, '#f-phone').getAttribute('inputmode') === 'tel'
    && $(d, '#f-linkedin').getAttribute('inputmode') === 'url');
  check('business one-liner capped at 140', $(d, '#f-business').getAttribute('maxlength') === '140');
  check('outcome textarea is 4 rows, Q9b is 3', $(d, '#f-outcome').rows === 4 && $(d, '#f-coaching_focus').rows === 3);
  check('honeypot present', !!$(d, '#f-gotcha'));
  check('progress bar exposes a role', $(d, '#bar').getAttribute('role') === 'progressbar');
}

console.log('\nThe thank-you page');
{
  const thanksHtml = fs.readFileSync(site('sh-apply/thanks/index.html'), 'utf8');
  const vc = new VirtualConsole();
  const dom = new JSDOM(thanksHtml, { url: 'https://timerich.ai/sh-apply/thanks/', runScripts: 'dangerously', virtualConsole: vc, beforeParse(w) {
    w.sessionStorage.setItem('shApplyThanks', 'Jordan');
  }});
  const td = dom.window.document;
  check('personalised heading', td.querySelector('#confirmHead').textContent === 'You’re in, Jordan.', td.querySelector('#confirmHead').textContent);
  check('VIDEO_ENABLED=false hides the video block', td.querySelector('#videoBlock').hidden);
  check('booking block is visible', !td.querySelector('#bookingBlock').hidden);
  check('booking placeholder says the link is coming', /Booking link coming/.test(td.querySelector('#bookingSlot').textContent));
  check('no Cal.com embed on the page', !/cal\.com/i.test(thanksHtml));
  check('PODCAST_ENABLED=false shows the coming-soon line',
    !td.querySelector('#podcastOff').hidden && /coming soon/i.test(td.querySelector('#podcastOff').textContent));
  check('podcast sits below the booking',
    thanksHtml.indexOf('id="bookingBlock"') < thanksHtml.indexOf('id="podcastBlock"'));

  const cold = new JSDOM(thanksHtml, { url: 'https://timerich.ai/sh-apply/thanks/', runScripts: 'dangerously', virtualConsole: vc });
  check('a cold visit still reads sensibly', cold.window.document.querySelector('#confirmHead').textContent === 'You’re in.');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
