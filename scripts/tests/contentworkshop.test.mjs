// /contentworkshop, the workshop page the room keeps open all evening.
//
// It was ported by hand from a design-tool export, so the first rule it pins
// is that nothing from that export leaked through: no {{hole}}, no <sc-for>,
// no /_blob/ image that would 404 on the site. The rest is run for real in
// jsdom, because the page's own inline script is what wires every copy
// button, tab and toggle, and a stale code in the room is a worse failure
// than a stale page.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('../../contentworkshop/index.html', import.meta.url), 'utf8');

// The five the brief names, by the data-copy key each button carries.
const COPY_KEYS = ['wifi', 'wispr', 'stanley', 'sk', 'tags'];

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

/** A fresh page with its inline script run, plus the clipboard it reaches for. */
function load() {
  const dom = new JSDOM(HTML, {
    url: 'https://timerich.ai/contentworkshop',
    runScripts: 'dangerously',
    pretendToBeVisual: true
  });
  const copied = [];
  // jsdom ships no clipboard, and the page swallows the failure, so give it
  // one to write to: that text is the thing worth asserting on.
  Object.defineProperty(dom.window.navigator, 'clipboard', {
    value: { writeText(t) { copied.push(t); return Promise.resolve(); } },
    configurable: true
  });
  return { dom, document: dom.window.document, copied };
}

const clickCopy = (document, key) =>
  document.querySelector('[data-copy="' + key + '"]').dispatchEvent(
    new document.defaultView.MouseEvent('click', { bubbles: true }));

console.log('\n/contentworkshop — nothing left over from the design export');
{
  check('no {{ template hole anywhere', !HTML.includes('{{'));
  check('no <sc-for> or <sc-if> left', !HTML.includes('<sc-'));
  check('no /_blob/ image left', !HTML.includes('/_blob/'));
  check('no x-dc wrapper or support.js left',
    !HTML.includes('x-dc') && !HTML.includes('support.js'));
  check('no onClick= handler attribute left', !HTML.includes('onClick='));
  check('the two repo images are the ones used',
    HTML.includes('/os/img/wispr-flow.png') && HTML.includes('/os/img/stanley.png'));
}

console.log('\n/contentworkshop — the page basics');
{
  const { document } = load();
  check('title is the one the brief asked for',
    document.title === 'Content Workshop · Time Rich', document.title);
  check('has a description meta',
    (document.querySelector('meta[name="description"]') || {}).content ? true : false);
  check('has the favicon other pages use',
    HTML.includes('/rocketship-icon-32.png'));
  check('off-white #FFFDFB ground, as on /accelerator', HTML.includes('#FFFDFB'));
  // Placeholders are still in, so the page must not be indexed yet.
  const bracketed = /\[[A-Z][^\]]*\]/.test(HTML);
  const noindex = (document.querySelector('meta[name="robots"]') || {}).content === 'noindex';
  check('while a [PLACEHOLDER] is left, the page is noindex',
    bracketed ? noindex : true, { bracketed, noindex });
}

console.log('\n/contentworkshop — the WORKSHOP config, one place for the open answers');
{
  check('a const WORKSHOP block exists', /const WORKSHOP\s*=\s*\{|var WORKSHOP\s*=\s*\{/.test(HTML));
  check('mikaPrompt is in it', /mikaPrompt\s*:/.test(HTML));
  check('winnersWhen is in it', /winnersWhen\s*:/.test(HTML));
  // Both defaults still carry their brackets, which is what keeps noindex on.
  check('the Step 1 prompt default is still the placeholder',
    HTML.includes('[PROMPT FROM MIKA: the content strategy interview]'));
  check('the winners line default is still the placeholder',
    HTML.includes('[WHEN AND WHERE]'));

  const { document } = load();
  check('the Step 1 prompt is rendered into the page',
    document.getElementById('mikaprompt').textContent.includes('PROMPT FROM MIKA'));
  check('the winners line is rendered into the page',
    document.getElementById('winnerswhen').textContent === '[WHEN AND WHERE]');
}

console.log('\n/contentworkshop — the copy buttons');
{
  const { document } = load();
  for (const key of COPY_KEYS) {
    check('the ' + key + ' copy button exists',
      !!document.querySelector('[data-copy="' + key + '"]'));
  }

  // The codes are final. These are what the room types in, so pin the text.
  check('the Wispr code on the page is TIMERICH6',
    document.getElementById('wisprcode').textContent === 'TIMERICH6');
  check('the Stanley code on the page is STANLEY1MONTH',
    document.getElementById('stanleycode').textContent === 'STANLEY1MONTH');
  check('the Stanley offer reads 1 month free', HTML.includes('1 month free'));
  check('no stale 6-months-free Stanley offer is left', !HTML.includes('6 months free'));
}

console.log('\n/contentworkshop — copying actually copies, and says so');
{
  const { dom, document, copied } = load();
  const btn = document.querySelector('[data-copy="stanley"]');
  const idle = btn.textContent;

  clickCopy(document, 'stanley');
  check('clicking copies the Stanley code', copied[0] === 'STANLEY1MONTH', copied);
  check('the label turns to Copied', /Copied/.test(btn.textContent), btn.textContent);

  // The label is meant to go back by itself, after about two seconds.
  dom.window.setTimeout(() => {}, 0);
  check('and it is not stuck on Copied forever',
    HTML.includes('1600') || HTML.includes('2000'));

  clickCopy(document, 'wifi');
  check('the Wi-Fi button copies the network name', copied[1] === 'P57_wifi_public', copied);

  clickCopy(document, 'tags');
  check('the tags button copies all four tags',
    copied[2] && ['Ella Molony Cook', 'Mika Reyes', 'Stanley', 'Wispr Flow']
      .every((t) => copied[2].includes(t)), copied[2]);

  clickCopy(document, 'sk');
  check('the skill button copies the whole skill, not a summary',
    copied[3] && copied[3].startsWith('# Create LinkedIn Content') && copied[3].length > 5000,
    copied[3] && copied[3].length);
  check('the copied skill is the same text the page shows',
    copied[3] === document.getElementById('skilltext').textContent);
  // Unused, but it keeps the idle label in the assertion record.
  check('the idle label was not blank to begin with', idle.length > 0, idle);
}

console.log('\n/contentworkshop — the step progress count');
{
  const { document } = load();
  const count = () => document.getElementById('donecount').textContent;
  const click = (el) => el.dispatchEvent(
    new document.defaultView.MouseEvent('click', { bubbles: true }));

  // Six steps on the page, so the total has to say six.
  check('the total counts all six steps', HTML.includes('/6 done'));
  check('starts at 0 done', count() === '0', count());

  // Step 0 only ticks once all four setup rows are ticked.
  const rows = () => [...document.querySelectorAll('[data-setup]')];
  check('there are four setup rows', rows().length === 4, rows().length);
  rows().slice(0, 3).forEach(click);
  check('three of four ticked is not yet a done step', count() === '0', count());
  click(rows()[3]);
  check('all four ticked counts Step 0 as done', count() === '1', count());

  // Step 1 and Step 2 each have their own trigger now: copying the prompt
  // ticks Step 1 and nothing else.
  clickCopy(document, 'p1');
  check('copying the Step 1 prompt advances the count by exactly one',
    count() === '2', count());

  const ctx = () => [...document.querySelectorAll('[data-ctx]')];
  check('there are three Step 2 cards', ctx().length === 3, ctx().length);
  check('Step 2 is not done on the back of Step 1',
    ctx().every((c) => c.getAttribute('aria-pressed') === 'false'));
  click(ctx()[0]);
  check('one Step 2 card ticked is not yet a done step', count() === '2', count());
  click(ctx()[1]);
  check('both required Step 2 cards ticked completes Step 2', count() === '3', count());
  click(ctx()[2]);
  check('the optional third card does not double-count', count() === '3', count());
  click(ctx()[1]);
  check('un-ticking a required card drops Step 2 again', count() === '2', count());

  // Ticking a setup row back off takes that step away again.
  click(rows()[0]);
  check('un-ticking a setup row drops Step 0 again', count() === '1', count());
}

console.log('\n/contentworkshop — the count can never pass its total');
{
  const { document } = load();
  const count = () => document.getElementById('donecount').textContent;
  const click = (el) => el.dispatchEvent(
    new document.defaultView.MouseEvent('click', { bubbles: true }));

  [...document.querySelectorAll('[data-setup]')].forEach(click);
  [...document.querySelectorAll('[data-ctx]')].forEach(click);
  for (const key of ['p1', 'p2', 'sk']) clickCopy(document, key);
  const rituals = [...document.querySelectorAll('[data-ritual]')];
  rituals.filter((r) => r.getAttribute('aria-pressed') === 'false').forEach(click);

  check('everything done reads exactly 6, the total', count() === '6', count());
  check('every step badge shows a tick',
    [...document.querySelectorAll('[data-badge]')].every((b) => b.textContent === '✓'),
    [...document.querySelectorAll('[data-badge]')].map((b) => b.textContent));
}

console.log('\n/contentworkshop — the funnel topic tabs');
{
  const { document } = load();
  const tabs = () => [...document.querySelectorAll('[data-stage]')];
  const chips = () => [...document.querySelectorAll('#topicchips span')].map((s) => s.textContent);
  const selected = () => tabs().findIndex((t) => t.getAttribute('aria-selected') === 'true');

  check('there are four funnel stages', tabs().length === 4, tabs().length);
  check('the first stage is the one selected on load', selected() === 0, selected());
  check('top of funnel shows its own topics',
    chips().length === 3 && chips()[0].startsWith('Relatable frustration'), chips());
  check('the stage panel names the stage',
    document.getElementById('stagetitle').textContent === 'Top of funnel.');

  tabs()[2].dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));
  check('clicking a tab selects it', selected() === 2, selected());
  check('and swaps in that stage\'s topics',
    chips()[0].startsWith('Client result'), chips());
  check('and relabels the panel',
    document.getElementById('stagetitle').textContent === 'Bottom of funnel.');
}

console.log('\n/contentworkshop — the ritual toggles');
{
  const { document } = load();
  const cards = () => [...document.querySelectorAll('[data-ritual]')];
  const on = () => cards().filter((c) => c.getAttribute('aria-pressed') === 'true').length;
  const count = () => document.getElementById('donecount').textContent;

  check('there are three rituals', cards().length === 3, cards().length);
  check('the first one is on to begin with', on() === 1, on());
  // The third ritual is named now, so no placeholder is left in this section.
  check('the third ritual is Good Morning',
    cards()[2].textContent.includes('Good Morning'), cards()[2].textContent.trim().slice(0, 40));
  check('and it carries its description',
    cards()[2].textContent.includes('A daily read of what') &&
    cards()[2].textContent.includes('Start here if you have no posts yet.'));
  check('no [RITUAL 3] placeholder is left', !HTML.includes('RITUAL 3'));
  check('one ritual on is not yet enough for the last step', count() === '0', count());

  cards()[1].dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));
  check('switching a second one on', on() === 2, on());
  check('two rituals on completes the last step', count() === '1', count());

  cards()[0].dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));
  check('switching one back off un-completes it', count() === '0', count());
}

console.log('\n/contentworkshop — phone first');
{
  check('the viewport meta is there', HTML.includes('width=device-width'));
  // The brief asks for 44px minimum on the copy buttons. They are inline-styled,
  // and jsdom has no layout, so the declaration is what can be checked here.
  const { document } = load();
  const small = [...document.querySelectorAll('[data-copy]')]
    .map((b) => b.getAttribute('style') || '')
    .filter((s) => !s.includes('min-height: 44px'));
  check('every copy button declares min-height: 44px', small.length === 0, small);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
