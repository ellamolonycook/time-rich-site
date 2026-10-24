// /contentworkshop, the workshop page the room keeps open all evening.
//
// It was ported by hand from a design-tool export, so the first rule it pins
// is that nothing from that export leaked through: no {{hole}}, no <sc-for>,
// no /_blob/ image that would 404 on the site. The rest is run for real in
// jsdom, because the page's own inline script is what wires every copy
// button, tab and toggle, and a stale code in the room is a worse failure
// than a stale page.
import { JSDOM } from 'jsdom';
import { readFileSync, existsSync } from 'node:fs';

const HTML = readFileSync(new URL('../../contentworkshop/index.html', import.meta.url), 'utf8');

// The five the brief names, by the data-copy key each button carries.
const COPY_KEYS = ['wifi', 'wispr', 'stanley', 'sk', 'tags'];

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

/** A fresh page with its inline script run, plus the clipboard it reaches for.
 *  `store` is the backing object behind localStorage, so a test can hand the
 *  page an evening already half ticked off, or read back what it saved. */
function load(store = {}) {
  const dom = new JSDOM(HTML, {
    url: 'https://timerich.ai/contentworkshop',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(win) {
      Object.defineProperty(win, 'localStorage', {
        value: {
          getItem: (k) => (k in store ? store[k] : null),
          setItem: (k, v) => { store[k] = String(v); },
          removeItem: (k) => { delete store[k]; },
        },
        configurable: true
      });
    }
  });
  const copied = [];
  // jsdom ships no clipboard, and the page swallows the failure, so give it
  // one to write to: that text is the thing worth asserting on.
  Object.defineProperty(dom.window.navigator, 'clipboard', {
    value: { writeText(t) { copied.push(t); return Promise.resolve(); } },
    configurable: true
  });
  return { dom, document: dom.window.document, copied, store };
}

/** A page whose storage throws on every touch: a private window, or site
 *  data blocked. It must still draw and still tick. */
function loadWithoutStorage() {
  const dom = new JSDOM(HTML, {
    url: 'https://timerich.ai/contentworkshop',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(win) {
      Object.defineProperty(win, 'localStorage', {
        get() { throw new Error('blocked'); },
        configurable: true
      });
    }
  });
  return { dom, document: dom.window.document };
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

console.log('\n/contentworkshop — the page says how many steps it has');
{
  // The build is "Before you start", then Steps 1 to 4. The page used to say
  // "five steps" in three places, written before the steps were numbered.
  const { document } = load();

  check('the hero does not promise five steps',
    !/five steps/i.test(HTML), (HTML.match(/.{0,50}five steps.{0,50}/i) || [])[0]);

  const hero = document.querySelector('h1').parentElement.querySelector('p');
  check('it describes the set-up and the four steps instead',
    /set up first, then four steps/i.test(hero.textContent), hero.textContent.trim());

  const desc = (sel) => (document.querySelector(sel) || {}).content || '';
  check('the meta description says the same thing',
    /set up, then four steps/i.test(desc('meta[name="description"]')), desc('meta[name="description"]'));
  check('and so does the og description, which is what a share card reads',
    /set up, then four steps/i.test(desc('meta[property="og:description"]')),
    desc('meta[property="og:description"]'));
  check('the two are word for word the same',
    desc('meta[name="description"]') === desc('meta[property="og:description"]'));

  // Twitter has no description tag of its own here and falls back to og:.
  check('the Twitter card is set up to fall back to the og description',
    desc('meta[name="twitter:card"]') === 'summary_large_image' &&
    document.querySelector('meta[name="twitter:description"]') === null);

  // The count the page actually keeps is six groups: Before you start, the
  // four steps, and After tonight. That is what the top bar totals.
  check('and the progress total still counts all six groups',
    HTML.includes('/6 done'));
}

console.log('\n/contentworkshop — the prizes, and who gets what');
{
  const { document } = load();
  const win = document.getElementById('win');
  const vip = document.getElementById('vipprize');

  check('the VIP prize sits in the challenge section, beside the five seats',
    vip !== null && win !== null && win.contains(vip));
  check('and after the five-seat heading, not before it',
    vip !== null && (document.getElementById('winh').compareDocumentPosition(vip) & 4) !== 0);

  check('it reads exactly as Ella wrote it, draw date and all',
    vip !== null && vip.textContent.replace(/\s+/g, ' ').trim() ===
      'Best post wins: a VIP setup by the Stanley team: brain, voice and rituals ' +
      'built with you ($1,000 value), plus 6 months of Stanley Premium. ' +
      'We draw the winner on Tuesday 27 October at 12pm ET.',
    vip && vip.textContent.replace(/\s+/g, ' ').trim());

  check('it is one prize for the best post, not another five-seat line',
    vip !== null && /Best post wins/.test(vip.textContent) &&
    !/5 seats|five seats/i.test(vip.textContent));

  // The date is said twice on the page now -- here and in "How to enter" --
  // and one of them going stale is worse than either. Both read the same
  // value, so there is still only one date to edit.
  check('the draw date comes from WORKSHOP.winnersWhen, not a second copy',
    /one\('#vipwhen'\)\.textContent = WORKSHOP\.winnersWhen;/.test(HTML));
  check('so both lines say the same thing',
    document.getElementById('vipwhen').textContent ===
    document.getElementById('winnerswhen').textContent &&
    document.getElementById('vipwhen').textContent === 'Tuesday 27 October at 12pm ET',
    [document.getElementById('vipwhen').textContent,
     document.getElementById('winnerswhen').textContent]);

  // Everyone in the room gets 6 months of Stanley free on TIMERICH6, and the
  // code card, the redeem card and the steps all have to say the same thing.
  const offer = document.getElementById('stanleycode').closest('div[style]').parentElement;
  check('the Stanley code on the page is TIMERICH6',
    document.getElementById('stanleycode').textContent === 'TIMERICH6');
  check('and the offer beside it reads 6 months free',
    /6 months free/.test(offer.textContent), offer.textContent.replace(/\s+/g, ' ').trim());
  check('the redeem steps say 100% off for 6 billing cycles too',
    /100% off for the next 6 billing cycles/.test(HTML));
  check('the redeem steps tell people to enter TIMERICH6 for Stanley',
    /Add promotion code<\/strong>, enter <strong[^>]*>TIMERICH6<\/strong>/.test(HTML));
  check('no STANLEY1MONTH or "1 month free" is left anywhere',
    !HTML.includes('STANLEY1MONTH') && !/1 month free/i.test(HTML));
}

console.log('\n/contentworkshop — how Wispr Flow is described');
{
  // Wispr Flow's own words for the product, and their line for anywhere the
  // page asks someone to bring a note-taker to a call.
  const { document } = load();

  check('Wispr Flow is named as voice dictation and Notetaker',
    /Voice dictation and Notetaker/.test(HTML),
    (HTML.match(/.{0,40}Notetaker.{0,40}/) || [])[0]);

  const recording = HTML.match(/Record, with everyone\u2019s OK/g) || [];
  check('and recording a call is asked for in their words',
    recording.length === 1, recording.length);

  // The Connectors sub-step is the one place that asks for it, so the line
  // has to be on that row rather than loose somewhere on the page.
  const row = document.querySelector('[data-item="i2b"]');
  check('the line sits on the Connectors sub-step',
    row !== null && /Record, with everyone\u2019s OK/.test(row.textContent),
    row && row.textContent.replace(/\s+/g, ' ').trim());
  check('which also names the Notetaker rather than just "your meetings"',
    row !== null && /Wispr Flow Notetaker/.test(row.textContent));

  // Wispr Flow asked for no mention of Granola on this page.
  check('Granola is not named anywhere on the page',
    !/granola/i.test(HTML), (HTML.match(/.{0,50}granola.{0,50}/i) || [])[0]);

  // The set-up steps in "Before you start", as Wispr Flow asked for them.
  const setup = document.getElementById('step-0');
  const text = setup.textContent.replace(/\s+/g, ' ');
  check('the set-up says to install on a laptop, through the referral link',
    /Install Wispr Flow on your laptop through/.test(text),
    (text.match(/Install Wispr Flow[^.]*\./) || [])[0]);
  check('and that the code goes in Settings \u2192 Plans and Billing',
    /Settings \u2192 Plans and Billing/.test(text));
  check('at the promo link at the bottom',
    /Scroll to the very bottom and click the promo link/.test(text));
  check('for 6 months Pro',
    /Enter TIMERICH6 for 6 months Pro/.test(text),
    (text.match(/.{0,24}TIMERICH6.{0,24}/g) || []));
  check('it warns the code is desktop-only and useless to a paying customer',
    /The code only works in the desktop app, and does nothing if you already pay for Wispr\./.test(text));
  check('and it tells anyone without a laptop what to do tonight',
    /No laptop\? Use the free phone app tonight and add the code on your laptop later\./.test(text));
  check('the old "not on your phone" line is gone, since the phone app is now the fallback',
    !/Not on your phone/.test(HTML));

  // The one link out to Wispr Flow is the referral URL, same as the portal.
  const links = [...document.querySelectorAll('a[href*="wisprflow.ai"]')];
  check('the download link is the referral URL',
    links.length === 1 && links[0].getAttribute('href') === 'https://ref.wisprflow.ai/ella-cook-vt27',
    links.map((a) => a.getAttribute('href')));
  check('and it opens in a new tab, marked sponsored',
    links.length === 1 && links[0].getAttribute('target') === '_blank' &&
    /\bnoopener\b/.test(links[0].getAttribute('rel') || '') &&
    /\bsponsored\b/.test(links[0].getAttribute('rel') || ''),
    links.length === 1 && links[0].getAttribute('rel'));
}

console.log('\n/contentworkshop — the WORKSHOP config, one place for the open answers');
{
  check('a const WORKSHOP block exists', /const WORKSHOP\s*=\s*\{|var WORKSHOP\s*=\s*\{/.test(HTML));
  check('mikaPrompt is in it', /mikaPrompt\s*:/.test(HTML));
  check('winnersWhen is in it', /winnersWhen\s*:/.test(HTML));
  const { document } = load();
  check('the Step 1 prompt is rendered into the page',
    document.getElementById('mikaprompt').textContent.trim().length > 0);
  check('the winners line is rendered into the page',
    document.getElementById('winnerswhen').textContent === 'Tuesday 27 October at 12pm ET',
    document.getElementById('winnerswhen').textContent);
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
  check('the Stanley code on the page is TIMERICH6',
    document.getElementById('stanleycode').textContent === 'TIMERICH6');
  check('the Stanley offer reads 6 months free', HTML.includes('Stanley · 6 months free'));
  check('no stale STANLEY1MONTH or 1-month Stanley offer is left',
    !HTML.includes('STANLEY1MONTH') && !HTML.includes('1 month free'));
}

console.log('\n/contentworkshop — copying actually copies, and says so');
{
  const { dom, document, copied } = load();
  const btn = document.querySelector('[data-copy="stanley"]');
  const idle = btn.textContent;

  clickCopy(document, 'stanley');
  check('clicking copies the Stanley code', copied[0] === 'TIMERICH6', copied);
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

console.log('\n/contentworkshop — Open Claude / Open ChatGPT carry the Step 1 prompt');
{
  const { dom, document, copied } = load();
  const prompt = document.getElementById('mikaprompt').textContent;
  const claude = document.querySelector('a[data-ai="claude"]');
  const gpt = document.querySelector('a[data-ai="chatgpt"]');
  check('there is an Open Claude button', !!claude && /Open Claude/.test(claude.textContent));
  check('there is an Open ChatGPT button', !!gpt && /Open ChatGPT/.test(gpt.textContent));
  check('Open Claude opens a new chat with the prompt filled in',
    claude.href.startsWith('https://claude.ai/new?q=') &&
    new URL(claude.href).searchParams.get('q') === prompt, claude.href.slice(0, 80));
  check('Open ChatGPT opens a new chat with the prompt filled in',
    gpt.href.startsWith('https://chatgpt.com/?q=') &&
    new URL(gpt.href).searchParams.get('q') === prompt, gpt.href.slice(0, 80));
  check('both stay under the 8000-character URL ceiling',
    claude.href.length <= 8000 && gpt.href.length <= 8000, [claude.href.length, gpt.href.length]);
  check('both open in a new tab, noopener',
    [claude, gpt].every((a) => a.target === '_blank' && /noopener/.test(a.rel)));
  claude.addEventListener('click', (e) => e.preventDefault(), { once: true });
  claude.click();
  check('clicking also copies the prompt, in case an AI ignores ?q=', copied[0] === prompt);
  check('and it says so', /Prompt copied/.test((document.getElementById('cwtoast') || {}).textContent || ''));
  const p1row = document.querySelector('[data-item="p1"]');
  check('and ticks the Step 1 copy row', !!p1row && p1row.getAttribute('aria-pressed') === 'true');
}

console.log('\n/contentworkshop — the build is four numbered dropdowns');
{
  const { document } = load();
  const boxes = [...document.querySelectorAll('details.stepbox')];

  check('there are five dropdowns: Step 1 to 4, then After tonight',
    boxes.length === 5, boxes.length);
  check('and they are numbered in order',
    boxes.map((b) => b.id).join(',') === 'step-1,step-2,step-3,step-4,step-5',
    boxes.map((b) => b.id));

  check('each one is a real <details>, so it works without JavaScript',
    boxes.every((b) => b.tagName === 'DETAILS' && b.querySelector('summary') !== null));

  // "Before you start" is not a dropdown: it stays open at the top.
  const before = document.getElementById('step-0');
  check('"Before you start" is still a plain section at the top, always open',
    before !== null && before.tagName === 'SECTION', before && before.tagName);
  check('and it comes before the first dropdown',
    before !== null && boxes.length > 0 &&
    (before.compareDocumentPosition(boxes[0]) & 4) !== 0);
  check('it carries the Wi-Fi, the codes and the set-up list',
    HTML.includes('BEFORE YOU START') &&
    document.getElementById('setuplist') !== null &&
    document.getElementById('wifivalue') !== null);

  const titles = boxes.map((b) => b.querySelector('.steptitle').textContent.trim());
  check('the four build steps are the ones from the call',
    titles.slice(0, 4).join(' | ') ===
      'Content strategy brain | Give Stanley your context | ' +
      'The linkedin-content skill | Your first post',
    titles);
  check('and Rituals is last, as "After tonight"',
    titles[4] === 'Turn on your rituals' &&
    boxes[4].querySelector('.stepkicker').textContent.includes('After tonight'),
    boxes[4].querySelector('.stepkicker').textContent);

  check('only Step 1 is open to begin with',
    boxes.filter((b) => b.open).map((b) => b.id).join(',') === 'step-1',
    boxes.filter((b) => b.open).map((b) => b.id));

  // Each step's rich content moved inside its own dropdown.
  check('Step 1 holds Mika\'s prompt and its copy button',
    boxes[0].querySelector('#mikaprompt') !== null &&
    boxes[0].querySelector('[data-copy="p1"]') !== null);
  check('Step 3 holds the skill and its copy button',
    boxes[2].querySelector('#skilltext') !== null &&
    boxes[2].querySelector('[data-copy="sk"]') !== null);
  check('Step 4 holds the funnel tabs and its copy button',
    boxes[3].querySelector('#funneltabs') !== null &&
    boxes[3].querySelector('[data-copy="p2"]') !== null);
  check('After tonight holds the ritual toggles',
    boxes[4].querySelector('#ritualcards') !== null);
}

console.log('\n/contentworkshop — each step is a checklist');
{
  const { document } = load();
  const click = (el) => el.dispatchEvent(
    new document.defaultView.MouseEvent('click', { bubbles: true }));
  const box = (n) => document.getElementById('step-' + n);
  const items = (n) => [...box(n).querySelectorAll('[data-item]')];
  const countOf = (n) => box(n).querySelector('.stepcount').textContent;
  const badge = (n) => box(n).querySelector('.stepbadge').textContent;

  for (const n of [1, 2, 3, 4]) {
    check('Step ' + n + ' has three tickable sub-steps', items(n).length === 3, items(n).length);
  }

  check('every row starts un-ticked',
    [1, 2, 3, 4].every((n) => items(n).every((i) => i.getAttribute('aria-pressed') === 'false')));
  check('the header counts them, long and short',
    countOf(1) === '0 of 3 done0/3', countOf(1));
  check('and shows the step number while it is unfinished',
    badge(1) === '1' && box(1).getAttribute('data-done') === 'no', badge(1));

  // Every tap target is at least 44px, which on a page with no layout is
  // the declared rule rather than a measurement.
  check('the rows and the step headers are 44px tap targets',
    /\.itemrow\{[^}]*min-height:44px/.test(HTML) &&
    /\.stepsum\{[^}]*min-height:44px/.test(HTML));

  // Ticking every item in a step marks it done and opens the next.
  check('Step 2 is shut while Step 1 is unfinished', box(2).open === false);
  items(1).forEach(click);
  check('every item ticked reads 3 of 3', countOf(1) === '3 of 3 done3/3', countOf(1));
  check('and the step is marked done, with a tick for its number',
    box(1).getAttribute('data-done') === 'yes' && badge(1) === '✓',
    badge(1));
  check('finishing a step opens the next one', box(2).open === true);

  // Un-ticking takes it back, and does not shut the next step under anyone.
  click(items(1)[0]);
  check('un-ticking a row drops the step again',
    box(1).getAttribute('data-done') === 'no' && countOf(1) === '2 of 3 done2/3', countOf(1));
  check('and the step it opened stays open', box(2).open === true);

  // Step 2's third row is the optional one: counted, but not required.
  const optional = items(2)[2];
  check('Step 2\'s third row is marked optional',
    optional.textContent.toLowerCase().includes('optional'), optional.textContent.trim().slice(0, 60));
  click(items(2)[0]);
  click(items(2)[1]);
  check('the two required rows alone complete Step 2',
    box(2).getAttribute('data-done') === 'yes' && box(3).open === true);
  check('while the count still says 2 of 3', countOf(2) === '2 of 3 done2/3', countOf(2));
  click(optional);
  check('ticking the optional one moves the count, not the verdict',
    countOf(2) === '3 of 3 done3/3' && box(2).getAttribute('data-done') === 'yes', countOf(2));
}

console.log('\n/contentworkshop — the copy buttons tick their own row');
{
  // The old page used the copy as the whole step. It now ticks one sub-step,
  // which is the same state map read a different way -- there is no second
  // record of what is done.
  const { document } = load();
  const box = (n) => document.getElementById('step-' + n);
  const row = (key) => document.querySelector('[data-item="' + key + '"]');

  for (const [key, step] of [['p1', 1], ['sk', 3], ['p2', 4]]) {
    check('Step ' + step + ' has a row driven by the ' + key + ' copy button',
      row(key) !== null);
    clickCopy(document, key);
    check('copying ticks that row',
      row(key).getAttribute('aria-pressed') === 'true');
    check('and does not finish the step on its own',
      box(step).getAttribute('data-done') === 'no',
      box(step).querySelector('.stepcount').textContent);
  }
}

console.log('\n/contentworkshop — the step progress count');
{
  const { document } = load();
  const count = () => document.getElementById('donecount').textContent;
  const click = (el) => el.dispatchEvent(
    new document.defaultView.MouseEvent('click', { bubbles: true }));

  // Six groups on the page -- Before you start, Steps 1 to 4, After tonight
  // -- so the total still says six.
  check('the total counts all six', HTML.includes('/6 done'));
  check('starts at 0 done', count() === '0', count());

  // Before you start only ticks once all four setup rows are ticked.
  const rows = () => [...document.querySelectorAll('[data-setup]')];
  check('there are four setup rows', rows().length === 4, rows().length);
  rows().slice(0, 3).forEach(click);
  check('three of four ticked is not yet a done step', count() === '0', count());
  click(rows()[3]);
  check('all four ticked counts it as done', count() === '1', count());

  // A step counts once every required row in it is ticked.
  [...document.querySelectorAll('#step-1 [data-item]')].forEach(click);
  check('finishing Step 1 advances the count by exactly one', count() === '2', count());

  const ctx = () => [...document.querySelectorAll('#step-2 [data-item]')];
  check('there are three Step 2 rows', ctx().length === 3, ctx().length);
  check('Step 2 is not done on the back of Step 1',
    ctx().every((c) => c.getAttribute('aria-pressed') === 'false'));
  click(ctx()[0]);
  check('one Step 2 row ticked is not yet a done step', count() === '2', count());
  click(ctx()[1]);
  check('both required Step 2 rows ticked completes Step 2', count() === '3', count());
  click(ctx()[2]);
  check('the optional third row does not double-count', count() === '3', count());
  click(ctx()[1]);
  check('un-ticking a required row drops Step 2 again', count() === '2', count());

  // Ticking a setup row back off takes that step away again.
  click(rows()[0]);
  check('un-ticking a setup row drops Before you start again', count() === '1', count());
}

console.log('\n/contentworkshop — the count can never pass its total');
{
  const { document } = load();
  const count = () => document.getElementById('donecount').textContent;
  const click = (el) => el.dispatchEvent(
    new document.defaultView.MouseEvent('click', { bubbles: true }));

  [...document.querySelectorAll('[data-setup]')].forEach(click);
  [...document.querySelectorAll('[data-item]')].forEach(click);
  const rituals = [...document.querySelectorAll('[data-ritual]')];
  rituals.filter((r) => r.getAttribute('aria-pressed') === 'false').forEach(click);

  check('everything done reads exactly 6, the total', count() === '6', count());
  check('every step badge in the top bar shows a tick',
    [...document.querySelectorAll('[data-badge]')].every((b) => b.textContent === '✓'),
    [...document.querySelectorAll('[data-badge]')].map((b) => b.textContent));
  check('and so does every dropdown header',
    [...document.querySelectorAll('.stepbadge')].every((b) => b.textContent === '✓'),
    [...document.querySelectorAll('.stepbadge')].map((b) => b.textContent));
}

console.log('\n/contentworkshop — a refresh does not lose the evening');
{
  const first = load();
  const click = (el) => el.dispatchEvent(
    new first.document.defaultView.MouseEvent('click', { bubbles: true }));

  [...first.document.querySelectorAll('[data-setup]')].forEach(click);
  [...first.document.querySelectorAll('#step-1 [data-item]')].forEach(click);
  check('two groups are done before the refresh',
    first.document.getElementById('donecount').textContent === '2');
  check('and something was written to storage',
    Object.keys(first.store).length === 1, Object.keys(first.store));

  // The same storage, a brand new page: the refresh.
  const again = load(first.store);
  check('the ticks come back', again.document.getElementById('donecount').textContent === '2',
    again.document.getElementById('donecount').textContent);
  check('row by row, not just the count',
    [...again.document.querySelectorAll('#step-1 [data-item]')]
      .every((i) => i.getAttribute('aria-pressed') === 'true'));
  check('and a finished step is still marked finished',
    again.document.getElementById('step-1').getAttribute('data-done') === 'yes');
  check('but nothing is re-opened on the way in: only Step 1 is open',
    [...again.document.querySelectorAll('details.stepbox')]
      .filter((b) => b.open).map((b) => b.id).join(',') === 'step-1',
    [...again.document.querySelectorAll('details.stepbox')].filter((b) => b.open).map((b) => b.id));
}

console.log('\n/contentworkshop — storage that is blocked costs nothing');
{
  // A private window throws on every touch of localStorage. The page has to
  // draw, and ticking has to work; it simply does not remember.
  const { document } = loadWithoutStorage();
  check('the page still renders its steps',
    document.querySelectorAll('details.stepbox').length === 5);
  const rows = [...document.querySelectorAll('#step-1 [data-item]')];
  rows.forEach((el) => el.dispatchEvent(
    new document.defaultView.MouseEvent('click', { bubbles: true })));
  check('and ticking still works',
    document.getElementById('step-1').getAttribute('data-done') === 'yes' &&
    document.getElementById('donecount').textContent === '1',
    document.getElementById('donecount').textContent);
}

console.log('\n/contentworkshop — the screenshots, on the page');
{
  const { document } = load();

  check('the link out to Mika\'s workshop notes is gone',
    !/workshop notes/i.test(HTML) && !HTML.includes('Content-Creation-Workshop-10-26'));

  const shots = [...document.querySelectorAll('figure.shot')];
  check('three screenshots are drawn', shots.length === 3, shots.length);

  check('each sits under the sub-step it belongs to',
    shots.every((f) => {
      const row = f.parentElement && f.parentElement.querySelector('[data-item]');
      return f.parentElement.tagName === 'LI' && row !== null &&
        (row.compareDocumentPosition(f) & 4) !== 0;
    }));

  check('they are the files in contentworkshop/img/, named by step and order',
    shots.map((f) => f.querySelector('img').getAttribute('src')).join(',') ===
      'img/step2-1.png,img/step2-2.png,img/step3-1.png',
    shots.map((f) => f.querySelector('img').getAttribute('src')));

  check('and every one of those files is actually there',
    shots.every((f) => existsSync(new URL(
      '../../contentworkshop/' + f.querySelector('img').getAttribute('src'), import.meta.url))));

  const imgs = shots.map((f) => f.querySelector('img'));
  check('each is lazy-loaded', imgs.every((i) => i.getAttribute('loading') === 'lazy'));
  check('each carries alt text that says what is on the screen',
    imgs.every((i) => (i.getAttribute('alt') || '').length > 30),
    imgs.map((i) => (i.getAttribute('alt') || '').length));
  check('each declares its own width and height, so nothing shifts as it loads',
    imgs.every((i) => /^\d+$/.test(i.getAttribute('width') || '') &&
                      /^\d+$/.test(i.getAttribute('height') || '')),
    imgs.map((i) => i.getAttribute('width') + 'x' + i.getAttribute('height')));

  // And those numbers are the file's own, read off the front of the PNG.
  // A screenshot recropped or replaced without the attributes following it
  // is a step that jumps as the image lands, and the page caps each one at
  // its declared width so a wrong number also draws it at the wrong size.
  check('the declared size is the size the file actually is',
    imgs.every((i) => {
      const bytes = readFileSync(new URL(
        '../../contentworkshop/' + i.getAttribute('src'), import.meta.url));
      return bytes.subarray(1, 4).toString('latin1') === 'PNG' &&
        bytes.readUInt32BE(16) === Number(i.getAttribute('width')) &&
        bytes.readUInt32BE(20) === Number(i.getAttribute('height'));
    }),
    imgs.map((i) => {
      const bytes = readFileSync(new URL(
        '../../contentworkshop/' + i.getAttribute('src'), import.meta.url));
      return i.getAttribute('src') + ': declared ' + i.getAttribute('width') + 'x' +
        i.getAttribute('height') + ', file ' + bytes.readUInt32BE(16) + 'x' + bytes.readUInt32BE(20);
    }));

  check('a tap opens the file full size, in its own tab',
    shots.every((f) => {
      const a = f.querySelector('a');
      return a !== null && a.getAttribute('href') === f.querySelector('img').getAttribute('src') &&
        a.getAttribute('target') === '_blank' && /\bnoopener\b/.test(a.getAttribute('rel') || '');
    }));

  check('the image fills the card on a phone',
    /\.shot img\{[^}]*width:100%/.test(HTML));

  // Steps 1 and 4 have no screenshots yet, so the page says where they go
  // rather than inventing any.
  check('the steps with nothing supplied carry a TODO instead of an invented image',
    (HTML.match(/TODO screenshots/g) || []).length === 2 &&
    document.querySelectorAll('#step-1 figure.shot').length === 0 &&
    document.querySelectorAll('#step-4 figure.shot').length === 0,
    (HTML.match(/TODO screenshots/g) || []).length);
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
  check('and its header counts them as switched on, not as done',
    document.querySelector('#step-5 .stepcount').textContent === '1 of 3 on1/3',
    document.querySelector('#step-5 .stepcount').textContent);

  cards()[1].dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));
  check('switching a second one on', on() === 2, on());
  check('two rituals on completes the last step', count() === '1', count());
  check('and the dropdown header says so',
    document.getElementById('step-5').getAttribute('data-done') === 'yes');

  cards()[0].dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));
  check('switching one back off un-completes it', count() === '0', count());
}

console.log('\n/contentworkshop — Mika\'s socials in the footer');
{
  const { document } = load();
  const box = document.getElementById('followmika');
  check('the footer has a Follow Mika Reyes group', !!box && /Follow Mika Reyes/.test(box.textContent));
  const hrefs = box ? [...box.querySelectorAll('a')].map((a) => a.getAttribute('href')) : [];
  check('with her LinkedIn and Instagram, as she asked',
    hrefs.length === 2 && hrefs[0] === 'https://linkedin.com/in/itsmikareyes' &&
    hrefs[1] === 'https://instagram.com/its.mikareyes', hrefs);
  check('opening in a new tab, so the workshop page stays open',
    box && [...box.querySelectorAll('a')].every((a) => a.target === '_blank' && /noopener/.test(a.rel)));
  check('and it sits inside the footer', !!box && !!box.closest('footer'));
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
