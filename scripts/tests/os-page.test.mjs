// The /os page's folded rows, run for real in jsdom: the page's own inline
// script wires them, so this drives the markup the way a reader would.
//
// The rule it exists to pin: every row keeps its anchor id, and the Stanley
// row is the one that is open when the page loads. Those two are what the
// Substack links and the nav depend on, and nothing else on the page would
// fail loudly if an edit broke them.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('../../os/index.html', import.meta.url), 'utf8');
// COMPASS leads: it is the doc every other row assumes you have.
const ROW_IDS = ['compass', 'stanley', 'skills', 'prompts', 'content-os', 'stack', 'live'];

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

/** A fresh page at the given URL, with its inline script run. */
function load(url = 'https://timerich.ai/os') {
  const dom = new JSDOM(HTML, { url, runScripts: 'dangerously', pretendToBeVisual: true });
  const { document } = dom.window;
  // jsdom has no layout, so scrollIntoView is missing on the elements the
  // page's anchor handler calls it on.
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  return { dom, document };
}

const isOpen = (document, id) => {
  const row = document.getElementById(id);
  return row.classList.contains('is-open') &&
    row.querySelector('.row-btn').getAttribute('aria-expanded') === 'true' &&
    row.querySelector('.row-panel').hidden === false;
};
const isFolded = (document, id) => {
  const row = document.getElementById(id);
  return !row.classList.contains('is-open') &&
    row.querySelector('.row-btn').getAttribute('aria-expanded') === 'false' &&
    row.querySelector('.row-panel').hidden === true;
};

console.log('\n/os — the rows');
{
  const { document } = load();

  check('every row id from the brief is on the page',
    ROW_IDS.every((id) => {
      const row = document.getElementById(id);
      return row && row.classList.contains('row');
    }),
    ROW_IDS.filter((id) => !document.getElementById(id)));

  check('the rows are in the brief\'s order, and there are no others',
    Array.from(document.querySelectorAll('#rowList > .row')).map((row) => row.id).join(',') === ROW_IDS.join(','),
    Array.from(document.querySelectorAll('#rowList > .row')).map((row) => row.id));

  check('every row is folded on load, so nothing is open by default',
    ROW_IDS.every((id) => isFolded(document, id)),
    ROW_IDS.filter((id) => !isFolded(document, id)));

  check('every row carries a scanning label above its headline',
    ROW_IDS.every((id) => {
      const label = document.getElementById(id).querySelector('.row-label');
      return label && label.textContent.trim().length > 1;
    }),
    ROW_IDS.map((id) => {
      const l = document.getElementById(id).querySelector('.row-label');
      return id + ':' + (l ? l.textContent.trim() : 'MISSING');
    }));

  check('the label comes before the headline it labels',
    ROW_IDS.every((id) => {
      const row = document.getElementById(id);
      const label = row.querySelector('.row-label');
      const title = row.querySelector('.row-title');
      return (label.compareDocumentPosition(title) & 4) !== 0;
    }));

  check('each row is opened by a button that names the panel it controls',
    ROW_IDS.every((id) => {
      const button = document.getElementById(id).querySelector('.row-btn');
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      return button.tagName === 'BUTTON' && panel && panel.classList.contains('row-panel');
    }));

  check('each panel points back at its button, for a screen reader',
    ROW_IDS.every((id) => {
      const row = document.getElementById(id);
      const button = row.querySelector('.row-btn');
      const panel = row.querySelector('.row-panel');
      return panel.getAttribute('aria-labelledby') === button.id;
    }));
}

console.log('\n/os — one row open at a time');
{
  const { document } = load();
  document.getElementById('stanley').querySelector('.row-btn').click();
  check('tapping a row opens it', isOpen(document, 'stanley'));
  document.getElementById('compass').querySelector('.row-btn').click();
  check('opening another row opens it', isOpen(document, 'compass'));
  check('and closes the one that was open', isFolded(document, 'stanley'));

  document.getElementById('compass').querySelector('.row-btn').click();
  check('clicking an open row folds it again', isFolded(document, 'compass'));
  check('and leaves every row folded', ROW_IDS.every((id) => isFolded(document, id)));
}

console.log('\n/os — the hash opens a row');
{
  const { document } = load('https://timerich.ai/os#compass');
  check('/os#compass opens the COMPASS row', isOpen(document, 'compass'));
  check('and no other row is open with it', ROW_IDS.filter((id) => id !== 'compass').every((id) => isFolded(document, id)));
}
{
  const { document } = load('https://timerich.ai/os#stanley');
  check('/os#stanley still opens Stanley, now that it is no longer first',
    isOpen(document, 'stanley') && isFolded(document, 'compass'));
}
{
  const { document } = load('https://timerich.ai/os#nope');
  check('a hash that is not a row leaves everything folded',
    ROW_IDS.every((id) => isFolded(document, id)));
}

console.log('\n/os — the nav and the nested fold');
{
  const { document } = load();
  const nav = Array.from(document.querySelectorAll('#navlinks a')).map((a) => a.getAttribute('href'));
  check('every nav link points at a row on the page',
    nav.every((href) => href.startsWith('#') && document.getElementById(href.slice(1))?.classList.contains('row')),
    nav);
  check('the nav runs COMPASS, Stanley, Skills, Prompts, Workshops',
    nav.join(',') === '#compass,#stanley,#skills,#prompts,#live', nav);
  check('the nav button offers the free resources, and still points at Substack',
    (() => {
      const cta = document.querySelector('.nav .btn');
      return cta.textContent.trim() === 'Free AI resources' &&
        cta.getAttribute('href') === 'https://timerichclub.com';
    })(),
    document.querySelector('.nav .btn').textContent.trim());

  document.querySelector('#navlinks a[href="#live"]').click();
  check('a nav link opens its row', isOpen(document, 'live'));

  document.querySelector('#navlinks a[href="#skills"]').click();
  const fold = document.getElementById('install');
  const foldButton = fold.querySelector('.fold-btn');
  const foldPanel = document.getElementById(foldButton.getAttribute('aria-controls'));
  check('"How to install a skill" starts folded',
    foldPanel.hidden === true && foldButton.getAttribute('aria-expanded') === 'false');
  foldButton.click();
  check('and opens on its own, without closing its row',
    foldPanel.hidden === false && foldButton.getAttribute('aria-expanded') === 'true' && isOpen(document, 'skills'));
}

console.log('\n/os — the copy buttons and the band');
{
  const { document } = load();
  const buttons = Array.from(document.querySelectorAll('[data-copy]'));
  check('five page prompts plus one per restored skill', buttons.length === 20, buttons.length);
  check('each one copies a block of text that is on the page',
    buttons.every((button) => {
      const source = document.getElementById(button.getAttribute('data-copy'));
      return source && source.textContent.trim().length > 100;
    }),
    buttons.map((b) => b.getAttribute('data-copy')));

  const band = document.getElementById('subscribe');
  check('the subscribe band is outside every row, so it is always visible',
    band && !band.closest('.row'));
}

console.log('\n/os — the mobile menu card');
{
  const { dom, document } = load();
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navlinks');
  const close = document.getElementById('navClose');
  const key = (name, shift) => document.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', { key: name, shiftKey: !!shift, bubbles: true, cancelable: true })
  );
  const behind = () => [
    document.querySelector('.skip'),
    document.querySelector('.wordmark'),
    document.querySelector('.nav .btn'),
    toggle,
    document.getElementById('main'),
    document.querySelector('footer'),
  ];

  check('the close button lives inside the card, not in the bar',
    close && close.closest('#navlinks') === links);

  toggle.click();
  check('the burger opens the card',
    links.classList.contains('open') && toggle.getAttribute('aria-expanded') === 'true');
  check('the burger keeps its icon rather than turning into a cross',
    toggle.textContent.trim() === '\u2630', toggle.textContent.trim());
  check('focus moves into the card, onto the close button',
    document.activeElement === close);
  // jsdom reflects `inert` as a plain property and does not act on it, so this
  // pins only that the page still marks the content behind. The behaviour it
  // buys is covered by the headless Chrome pass, not here.
  check('everything behind the scrim is marked inert',
    behind().every((node) => node.inert === true),
    behind().map((node) => node.tagName + ':' + node.inert));

  const stops = Array.from(links.querySelectorAll('button, a[href]'));
  check('the card holds the close button and the five links, in that order',
    stops.length === 6 && stops[0] === close, stops.length);

  stops[stops.length - 1].focus();
  key('Tab');
  check('Tab off the last link wraps to the close button', document.activeElement === close);
  close.focus();
  key('Tab', true);
  check('Shift+Tab off the close button wraps to the last link',
    document.activeElement === stops[stops.length - 1]);
  stops[1].focus();
  key('Tab');
  check('Tab in the middle of the card is left to the browser',
    document.activeElement === stops[1]);

  key('Escape');
  check('Escape closes the card', !links.classList.contains('open'));
  check('and hands focus back to the burger', document.activeElement === toggle);
  check('and lets the page behind go again',
    behind().every((node) => node.inert === false),
    behind().map((node) => node.tagName + ':' + node.inert));
}

{
  const { document } = load();
  const links = document.getElementById('navlinks');
  document.getElementById('navToggle').click();
  document.getElementById('navClose').click();
  check('the close button closes the card', !links.classList.contains('open'));

  document.getElementById('navToggle').click();
  document.querySelector('.nav').dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));
  check('a tap on the backdrop closes the card', !links.classList.contains('open'));

  document.getElementById('navToggle').click();
  links.querySelector('a[href="#live"]').click();
  check('picking a link closes the card and opens its row',
    !links.classList.contains('open') && document.getElementById('live').classList.contains('is-open'));
}

console.log('\n/os — the giveaway band');
{
  const { document } = load();
  const band = document.getElementById('giveaway');
  const hero = document.querySelector('.hero');

  check('the giveaway band is on the page', !!band);
  check('it sits above the hero',
    (band.compareDocumentPosition(hero) & 4) !== 0);
  check('it is the first thing inside main, so it follows the nav',
    document.getElementById('main').firstElementChild === band);
  check('it is a full-width band, never inside a dropdown row',
    !band.closest('.row') && band.parentElement === document.getElementById('main'));

  const img = band.querySelector('img');
  check('it carries the speaker image', img && /giveaway-accelerator\.png$/.test(img.getAttribute('src')), img && img.getAttribute('src'));
  check('the image names every speaker in its alt text',
    img.getAttribute('alt') === 'Superhuman Accelerator speakers: Cien Solon, Taylor Offer, ' +
      'AJ Yadav, Terry Rice, Ella Cook, Matyas Kolsofszki and ViKa Victoria',
    img.getAttribute('alt'));
  check('the image reserves its box, so loading it cannot shove the hero down',
    img.getAttribute('width') === '1106' && img.getAttribute('height') === '467');

  const primary = band.querySelector('.btn');
  check('the primary button is the LinkedIn connect, in a new tab',
    primary.textContent.trim() === 'Connect with Ella' &&
    primary.getAttribute('href') === 'https://www.linkedin.com/in/ellamolonycook/' &&
    primary.getAttribute('target') === '_blank' &&
    /noopener/.test(primary.getAttribute('rel') || ''),
    primary.getAttribute('href'));
  check('the LinkedIn URL is the same one the footer uses',
    primary.getAttribute('href') ===
      document.querySelector('footer a[href*="linkedin"]').getAttribute('href'));

  const secondary = band.querySelector('.text-link');
  check('the secondary link points at the Accelerator',
    secondary.textContent.trim() === 'See the Accelerator' &&
    secondary.getAttribute('href') === 'https://timerich.ai/accelerator',
    secondary.getAttribute('href'));

  const steps = Array.from(band.querySelectorAll('.enter li'));
  check('two entry steps, each opening on a bold verb, with no numbering',
    steps.length === 2 &&
    steps.every((li) => li.firstElementChild && li.firstElementChild.tagName === 'STRONG') &&
    steps.every((li) => !/^\d/.test(li.textContent.trim())),
    steps.map((li) => li.textContent.trim()));

  check('the hash target is the band itself, so slides can deep-link to it',
    band.id === 'giveaway' && band.tagName === 'SECTION');
  check('it is not one of the folded rows, so it never closes',
    !Array.from(document.querySelectorAll('#rowList > .row')).includes(band));
}

// The seven headings the rewrite put on every prompt, in the order the
// brief sets. Order is the point: a prompt that red-teams itself after it
// has already answered is not doing the job.
const HEADINGS = ['ROLE', 'SECOND OPINION', 'CONTEXT', 'TASK', 'RED TEAM', 'BLIND SPOTS', 'OUTPUT'];

// A heading is a line that is nothing but the heading, so a prompt that
// merely mentions "red team" in a sentence does not count as having one.
function headingsOf(text) {
  return text.split('\n').map((line) => line.trim()).filter((line) => HEADINGS.includes(line));
}

function hasTheShape(text) {
  return headingsOf(text).join('|') === HEADINGS.join('|');
}

const SKILL_PROMPTS = [
  'Content Planner', 'Profile Optimizer', 'Interviewer', 'Hook Extractor',
  'Post Writer', 'Humanizer', 'Repurposer', 'Comment Drafter', 'Reply Handler',
  'Thread Monitor', 'Engager Analytics', 'Employee Advocacy', 'Story Superhuman',
  'Social Proof', 'CTA Writer'
];

console.log('\n/os — the hero, the band and the footer');
{
  const { document } = load();
  check('the hero no longer carries buttons',
    document.querySelectorAll('.hero .btn').length === 0,
    document.querySelectorAll('.hero .btn').length);

  const bandButtons = Array.from(document.querySelectorAll('.band .btn'));
  check('both buttons now sit in the subscribe band', bandButtons.length === 2, bandButtons.length);
  check('Subscribe free leads, pointing at Substack',
    bandButtons[0].textContent.trim() === 'Subscribe free' &&
    bandButtons[0].getAttribute('href') === 'https://timerichclub.com',
    bandButtons[0].getAttribute('href'));
  check('Set up Stanley follows it as the secondary',
    bandButtons[1].textContent.trim() === 'Set up Stanley' &&
    bandButtons[1].getAttribute('href') === '#stanley' &&
    bandButtons[1].classList.contains('ghost'));
  check('the buttons sit under the band body copy',
    (() => {
      const body = document.querySelector('.band p');
      const row = document.querySelector('.band .btn-row');
      return (body.compareDocumentPosition(row) & 4) !== 0;
    })());

  bandButtons[1].click();
  check('the band Stanley button opens the Stanley row, as the hero one did',
    isOpen(document, 'stanley'));
}
{
  const { document } = load();
  const disclosure = document.querySelector('footer .disclosure');
  check('the referral disclosure is in the footer',
    disclosure && disclosure.textContent.trim() ===
      'Some links on this page are referral links, including Stanley, a Time Rich partner.',
    disclosure && disclosure.textContent.trim());
  check('and no longer inside the Stanley row',
    !/Time Rich partner/.test(document.getElementById('stanley').textContent));

  const sub = document.getElementById('content-os').querySelector('.row-sub');
  check('the Content OS row leads on the template, then what it holds',
    document.getElementById('content-os').querySelector('.row-title').textContent.trim() === 'Content OS' &&
    sub.textContent.trim() === 'Free Notion template. Every idea, draft and post in one place your AI can read.',
    sub.textContent.trim());
}

console.log('\n/os — the restored skill prompts');
{
  const { document } = load();
  const fold = document.getElementById('skill-prompts');
  check('the fold lives inside the LinkedIn skills row',
    fold && fold.closest('.row') === document.getElementById('skills'));

  const button = fold.querySelector('.fold-btn');
  const panel = document.getElementById(button.getAttribute('aria-controls'));
  check('it is labelled for what it holds and starts folded',
    button.textContent.trim().startsWith('Copy the prompt for each skill') &&
    panel.hidden === true && button.getAttribute('aria-expanded') === 'false',
    button.textContent.trim());

  const items = Array.from(panel.querySelectorAll('.skill-prompts > li'));
  check('one line per skill from the old page', items.length === SKILL_PROMPTS.length, items.length);
  check('every line is a skill name plus a copy button',
    items.every((li) =>
      li.querySelector('.skill-prompt-name') &&
      li.querySelector('button[data-copy]') &&
      li.querySelector('button[data-copy]').textContent.trim() === 'Copy prompt'));

  // Every skill prompt was rewritten into the seven-part shape, so what is
  // pinned now is the shape rather than the old opening line.
  const footer = document.getElementById('masterPromptParagraph').textContent;
  const results = SKILL_PROMPTS.map((name, index) => {
    const li = items[index];
    const source = document.getElementById(li.querySelector('button[data-copy]').getAttribute('data-copy'));
    const text = source ? source.textContent : '';
    return {
      name,
      nameShown: li.querySelector('.skill-prompt-name').textContent.trim() === name,
      shape: hasTheShape(text),
      headings: headingsOf(text).join('|'),
      // The rewrite folded the master paragraph's job into RED TEAM and
      // BLIND SPOTS, so trailing it as well would say it twice.
      trails: text.endsWith('\n\n' + footer),
      named: /\[[^\]]+\]/.test(text),
    };
  });
  check('the skills are listed in the old page order',
    results.every((r) => r.nameShown), results.filter((r) => !r.nameShown).map((r) => r.name));
  check('every skill prompt has all seven headings, in order',
    results.every((r) => r.shape), results.filter((r) => !r.shape).map((r) => r.name + ': ' + r.headings));
  check('none of them still trails the master paragraph, which the shape absorbed',
    results.every((r) => !r.trails), results.filter((r) => r.trails).map((r) => r.name));
  check('each one still leaves the member-specific bits in square brackets',
    results.every((r) => r.named), results.filter((r) => !r.named).map((r) => r.name));

  check('the prompts are out of the way until asked for',
    items.every((li) => document.getElementById(li.querySelector('button[data-copy]').getAttribute('data-copy')).hidden));
  check('the old skill cards and ZIP downloads did not come back with them',
    !/\/downloads\//.test(document.body.innerHTML) && !/Download skill/.test(document.body.textContent));
}

// Both of these were rewritten into the seven-part shape, so they are no
// longer pinned word for word. What is pinned is the shape, and the parts of
// the old output specification a member actually works from: a silent loss
// of the table columns would not show up anywhere else.
const NOTETAKER_KEEPS = [
  'Granola',
  'Show me the kept and skipped lists and ask "Right calls?" before you start.',
  'My ideal client in one line: [role] at [stage] who [trigger] and is stuck on [problem #1].',
  'Title (a hook, first person, max 12 words) | Priority (High, Medium, Low) | Date | Why it lands with my client',
  'Max 5 stories and 10 ideas.',
  'The one story to post first, and why.',
  'a founder I work with',
];
const STORY_BANK_KEEPS = [
  'Story Name | The Hook (one line, in my words) | Type | Status | Takeaway | Question it answers | Conflict | Resolution | How I fit in | Times told | Audience evidence | Next place to tell it | Source',
  'Badass (I backed myself and it worked)',
  'Shit to Shift (something bad forced the breakthrough)',
  'Status: Banked, Testing, or Needs detail.',
  'Held back',
  'Never invent.',
];
const AUDIT_KEEPS = [
  'Department | Task | How often | Hours per month (estimate) | Evidence (link to email, thread or doc) | Skill, Scheduled task, Both or Cut | Why, in one line | Trigger or schedule',
  'the top 5 items ranked by hours saved per month',
  'this is an audit',
];

console.log('\n/os — the notetaker prompt block');
{
  const { document } = load();
  const block = document.getElementById('notetaker');
  check('the block is on the page', !!block);
  check('it sits under the hero and above the subscribe band',
    (document.querySelector('.hero').compareDocumentPosition(block) & 4) !== 0 &&
    (block.compareDocumentPosition(document.getElementById('subscribe')) & 4) !== 0);
  check('it is always visible, never inside a dropdown row',
    !block.closest('.row') && !block.closest('[hidden]'));

  check('the eyebrow points the reader at the starting line',
    block.querySelector('.eyebrow').textContent.trim().toUpperCase() === 'START HERE · AI NOTETAKER PROMPT',
    block.querySelector('.eyebrow').textContent.trim());
  check('the headline is the brief’s',
    block.querySelector('h2').textContent.trim() === 'Turn your calls into content.',
    block.querySelector('h2').textContent.trim());
  const body = block.querySelector('.note-card > p:not(.eyebrow)');
  check('the body tells the reader what to paste and what comes back',
    /notetaker connected/.test(body.textContent) && /ideas worth posting/.test(body.textContent),
    body.textContent.slice(0, 60));

  const copy = block.querySelector('[data-copy]');
  check('a copy button sits above the fold', copy && copy.textContent.trim() === 'Copy the prompt');
  const notetakerText = document.getElementById(copy.getAttribute('data-copy')).textContent;
  check('and it copies a prompt in the seven-part shape',
    hasTheShape(notetakerText), headingsOf(notetakerText).join('|'));
  check('the rewrite kept the output specification a member works from',
    NOTETAKER_KEEPS.every((part) => notetakerText.includes(part)),
    NOTETAKER_KEEPS.filter((part) => !notetakerText.includes(part)));
  check('and it carries a second opinion, which the old one did not',
    /SECOND OPINION\nAlso answer as a qualitative researcher/.test(notetakerText));

  const fold = block.querySelector('.fold');
  const foldBtn = fold.querySelector('.fold-btn');
  const foldPanel = document.getElementById(foldBtn.getAttribute('aria-controls'));
  check('the prompt itself is folded away by default',
    foldBtn.textContent.trim().startsWith('See the prompt') &&
    foldPanel.hidden === true && foldBtn.getAttribute('aria-expanded') === 'false',
    foldBtn.textContent.trim());
  foldBtn.click();
  check('and the fold opens to show it',
    foldPanel.hidden === false && foldBtn.getAttribute('aria-expanded') === 'true' &&
    foldPanel.querySelector('.prompt-text'));

  check('the block has its own anchor for /os#notetaker',
    block.id === 'notetaker' && block.tagName === 'SECTION');
}

console.log('\n/os — the Story Bank prompt');
{
  const { document } = load();
  const items = Array.from(document.querySelectorAll('#prompts .item h3')).map((h) => h.textContent.trim());
  check('it is the third item, after the audit and before Save it once',
    items.join(' | ') === 'The master prompt | Recurring work audit | Find my stories | Save it once',
    items.join(' | '));

  const item = Array.from(document.querySelectorAll('#prompts .item'))
    .find((el) => el.querySelector('h3').textContent.trim() === 'Find my stories');
  check('it says when to run it and what it banks',
    /once a month/.test(item.querySelector('p').textContent) &&
    /stories you already tell/.test(item.querySelector('p').textContent));

  const copy = item.querySelector('[data-copy]');
  const storyText = document.getElementById(copy.getAttribute('data-copy')).textContent;
  check('its button copies a prompt in the seven-part shape',
    copy.textContent.trim() === 'Copy the prompt' && hasTheShape(storyText),
    headingsOf(storyText).join('|'));
  check('the rewrite kept the story table and the types',
    STORY_BANK_KEEPS.every((part) => storyText.includes(part)),
    STORY_BANK_KEEPS.filter((part) => !storyText.includes(part)));

  check('the Prompts row no longer counts its prompts',
    document.getElementById('prompts').querySelector('.row-sub').textContent.trim() === 'Prompts worth saving.',
    document.getElementById('prompts').querySelector('.row-sub').textContent.trim());
}


console.log('\n/os — open in your AI');
{
  const { document } = load();

  const AI = { claude: 'https://claude.ai/new', chatgpt: 'https://chatgpt.com/', grok: 'https://grok.com/' };
  const links = Array.from(document.querySelectorAll('[data-ai]'));

  // Every prompt on the page that has a Copy button has the three buttons
  // beside it: the fifteen skill prompts, the notetaker, the audit, the
  // story bank and the master prompt.
  const copyIds = Array.from(document.querySelectorAll('[data-copy]'))
    .map((b) => b.getAttribute('data-copy'));
  const aiIds = [...new Set(links.map((a) => a.getAttribute('data-ai-src')))];
  check('nineteen prompts carry the buttons', aiIds.length === 19, aiIds.length);
  check('three buttons for each, one per AI',
    links.length === aiIds.length * 3 &&
    aiIds.every((id) => links.filter((a) => a.getAttribute('data-ai-src') === id).length === 3),
    links.length);
  check('every one of them points at a prompt that is really on the page',
    aiIds.every((id) => document.getElementById(id)),
    aiIds.filter((id) => !document.getElementById(id)));
  check('and every prompt with a Copy button got them, bar the shortcut copy',
    copyIds.filter((id) => !aiIds.includes(id)).join(',') === 'masterPromptParagraph',
    copyIds.filter((id) => !aiIds.includes(id)));
  check('the three are Claude, ChatGPT and Grok, in that order',
    aiIds.every((id) => links.filter((a) => a.getAttribute('data-ai-src') === id)
      .map((a) => a.getAttribute('data-ai')).join('|') === 'claude|chatgpt|grok'));

  check('each opens a new tab and cannot reach back into this one',
    links.every((a) => a.target === '_blank' && /\bnoopener\b/.test(a.rel)));
  check('each says which AI it opens, out loud as well as on screen',
    links.every((a) => /^Open in (Claude|ChatGPT|Grok)$/.test(a.textContent.trim()) &&
      /^Open this prompt in (Claude|ChatGPT|Grok)$/.test(a.getAttribute('aria-label'))));
  check('they are the ghost pill, not a new kind of button',
    links.every((a) => a.classList.contains('btn') && a.classList.contains('ghost')));
  check('nothing was left pointing at the placeholder href',
    links.every((a) => a.getAttribute('href') !== '#'),
    links.filter((a) => a.getAttribute('href') === '#').length);

  // The short path: the whole prompt rides in the query string.
  const short = links.find((a) => a.getAttribute('data-ai-src') === 'sp-social-proof' &&
    a.getAttribute('data-ai') === 'claude');
  const shortText = document.getElementById('sp-social-proof').textContent;
  check('a short prompt opens the chat with the prompt already in it',
    short.href === 'https://claude.ai/new?q=' + encodeURIComponent(shortText),
    short.href.slice(0, 60));
  check('and the whole prompt is in there, not a truncated copy',
    decodeURIComponent(short.href.split('?q=')[1]) === shortText);

  // Line breaks and the characters a prompt is full of survive the trip.
  check('line breaks are encoded, not dropped',
    short.href.includes('%0A') && shortText.includes('\n'));
  for (const [name, needle, encoded] of [
    ['the pipes in a table spec', '|', '%7C'],
    ['the square brackets round a placeholder', '[', '%5B'],
    ['the quotes inside a prompt', '"', '%22'],
  ]) {
    const withIt = links.find((a) => {
      const t = document.getElementById(a.getAttribute('data-ai-src')).textContent;
      return a.getAttribute('data-ai') === 'claude' && t.includes(needle) &&
        a.href.startsWith('https://claude.ai/new?q=');
    });
    check(name + ' survive encoding', Boolean(withIt) && withIt.href.includes(encoded));
  }
  const curly = links.find((a) => a.getAttribute('data-ai') === 'grok' &&
    document.getElementById(a.getAttribute('data-ai-src')).textContent.includes('\u2019') &&
    a.href.startsWith('https://grok.com/?q='));
  check('a curly apostrophe survives as UTF-8, not as a mangled byte',
    Boolean(curly) && curly.href.includes('%E2%80%99'));

  // The long path: nothing is ever cut off, so the text goes to the
  // clipboard and the AI opens on a blank chat instead.
  const MAX = 6000;
  const tooLong = links.filter((a) => {
    const t = document.getElementById(a.getAttribute('data-ai-src')).textContent;
    const ai = AI[a.getAttribute('data-ai')];
    const q = (ai === 'https://claude.ai/new' ? ai + '?q=' : ai + '?q=') + encodeURIComponent(t);
    return q.length > MAX;
  });
  check('every prompt here is short enough to arrive prefilled',
    tooLong.length === 0, tooLong.map((a) => a.getAttribute('data-ai-src')));
  check('no href anywhere runs past the ceiling',
    links.every((a) => a.href.length <= MAX),
    Math.max(...links.map((a) => a.href.length)));
  check('the fallback still opens the right AI, just on a blank chat',
    tooLong.every((a) => Object.values(AI).includes(a.href)));

  // The page says so, rather than leaving the reader with an empty chat.
  const script = HTML.slice(HTML.indexOf('Open in your AI'));
  check('and the reader is told the prompt is on the clipboard',
    /Copied\. Paste it into the chat\./.test(script));
  check('the click is tracked the way the page tracks everything else',
    /track\("prompt_open_ai", \{ ai: key, id: id \}\)/.test(script));
  check('the fallback is a link the browser follows, never window.open',
    !/window\.open\(/.test(script));
}

console.log('\n/os — open in your AI, when the prompt is too long for a URL');
{
  // Nothing on /os is long enough today, so the fallback is driven with a
  // prompt that is. A truncated prompt is worse than no prompt, so what is
  // pinned here is that the text is never cut: the link goes to a blank
  // chat and the page puts the prompt on the clipboard instead.
  const LONG = 'ROLE\n' + 'word '.repeat(2000).trim();
  const html = HTML.replace(
    /(<pre class="prompt-text sr-prompt" id="sp-social-proof" hidden>)[\s\S]*?(<\/pre>)/,
    (_m, open, close) => open + LONG + close);
  check('the stand-in really is too long to carry in a URL',
    ('https://claude.ai/new?q=' + encodeURIComponent(LONG)).length > 6000);

  const dom = new JSDOM(html, { url: 'https://timerich.ai/os', runScripts: 'dangerously', pretendToBeVisual: true });
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  const { document } = dom.window;

  const AI = { claude: 'https://claude.ai/new', chatgpt: 'https://chatgpt.com/', grok: 'https://grok.com/' };
  const fellBack = Array.from(document.querySelectorAll('[data-ai-src="sp-social-proof"]'));
  check('all three fall back to a blank chat',
    fellBack.length === 3 && fellBack.every((a) => a.href === AI[a.getAttribute('data-ai')]),
    fellBack.map((a) => a.href));
  check('and not one of them carries a half a prompt',
    fellBack.every((a) => !a.href.includes('?q=')), fellBack.map((a) => a.href));

  // The prompt still reaches the reader, by the other route.
  let copied = null;
  dom.window.navigator.clipboard = { writeText: (t) => { copied = t; return Promise.resolve(); } };
  fellBack[0].click();
  check('the whole prompt goes to the clipboard instead, uncut',
    copied === document.getElementById('sp-social-proof').textContent && copied.length > 6000,
    copied === null ? 'nothing copied' : copied.length);

  // The short prompts on the same page are untouched by any of this.
  const stillShort = Array.from(document.querySelectorAll('[data-ai-src="sp-cta-writer"]'));
  check('a short prompt beside it still arrives prefilled',
    stillShort.every((a) => a.href.includes('?q=')));
}

console.log('\n/os — the two fixes from the review');
{
  const { document } = load();

  // The Context page line, last on every rewritten prompt.
  const CONTEXT_LINE = 'Last, tell me what you learned about me that should be saved to my Context page.';
  const rewritten = [...SKILL_PROMPTS.keys()].map((i) => document.querySelectorAll('.skill-prompts [data-copy]')[i])
    .map((b) => b.getAttribute('data-copy'))
    .concat(['notetakerPrompt', 'auditPrompt', 'storyBankPrompt']);
  check('all eighteen rewritten prompts are accounted for', rewritten.length === 18, rewritten.length);

  const missing = rewritten.filter((id) => {
    const t = document.getElementById(id).textContent.trimEnd();
    return !t.endsWith(CONTEXT_LINE);
  });
  check('every one of them ends on the Context page line', missing.length === 0, missing);
  check('and it is the last line of OUTPUT, after the never-guess rule',
    rewritten.every((id) => {
      const lines = document.getElementById(id).textContent.trimEnd().split('\n');
      return lines[lines.length - 1] === CONTEXT_LINE &&
        /Never guess\.$/.test(lines[lines.length - 2]);
    }));
  check('the two prompts left alone did not get it',
    !document.getElementById('masterPrompt').textContent.includes(CONTEXT_LINE) &&
    !document.getElementById('masterPromptParagraph').textContent.includes(CONTEXT_LINE));

  // The capture block, back in the notetaker's CONTEXT, word for word.
  const CAPTURE = [
    'From each call, capture:',
    "1. Ideal client evidence: who they are, what made them reach out now, every problem they named, what they already tried, their exact words for the problem and the goal, what they only hinted at, their objections, the win that would make them tell a friend, and who wasn't a fit. Cite the call for every line. Label guesses as guesses.",
    "2. Stories: something that happened, with a person, a moment, some tension and an outcome, that I could tell out loud in 60 seconds. Mine, or a client's with names removed.",
    "3. Ideas: a question others would ask too, an opinion against common advice, a framework, a stat or result, or a problem in the client's own words.",
  ].join('\n');

  const notetaker = document.getElementById('notetakerPrompt').textContent;
  check('the notetaker carries the capture block word for word', notetaker.includes(CAPTURE),
    notetaker.slice(notetaker.indexOf('From each call'), notetaker.indexOf('From each call') + 80));
  const context = notetaker.slice(notetaker.indexOf('CONTEXT'), notetaker.indexOf('TASK'));
  check('and it sits in CONTEXT, not somewhere else in the prompt',
    context.includes(CAPTURE));
  check('with the sources above it and the extra facts below it',
    context.indexOf('Right calls?') < context.indexOf('From each call, capture:') &&
    context.indexOf('From each call, capture:') < context.indexOf('Extra facts:'));
  check('the prompt still has all seven headings, in order',
    hasTheShape(notetaker), headingsOf(notetaker).join('|'));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
