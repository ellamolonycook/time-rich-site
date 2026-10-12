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

const OLD_SKILL_PROMPTS = [
  ["Content Planner", "Plan my week on LinkedIn. My audience is [who "],
  ["Profile Optimizer", "Review my profile and run a full profile audit"],
  ["Interviewer", "Interview me and build my Story Bank. Ask one "],
  ["Hook Extractor", "Reverse-engineer the hook formula in this post"],
  ["Post Writer", "Write me a LinkedIn post about [your topic]. M"],
  ["Humanizer", "Humanize this draft and scrub the AI tells, th"],
  ["Repurposer", "Repurpose this for LinkedIn and re-hook it so "],
  ["Comment Drafter", "Draft me a comment on this post that the autho"],
  ["Reply Handler", "Sweep the comments on this post and draft a re"],
  ["Thread Monitor", "Monitor my comments and tell me what threads n"],
  ["Engager Analytics", "Tell me who engaged with this post and segment"],
  ["Employee Advocacy", "Help me get the team posting and launch advoca"],
  ["Story Superhuman", "Mine my calls for stories and build my story b"],
  ["Social Proof", "Write me social proof lines for this result: f"],
  ["CTA Writer", "Write CTAs for this post about [your topic]. M"]
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
  check('one line per skill from the old page', items.length === OLD_SKILL_PROMPTS.length, items.length);
  check('every line is a skill name plus a copy button',
    items.every((li) =>
      li.querySelector('.skill-prompt-name') &&
      li.querySelector('button[data-copy]') &&
      li.querySelector('button[data-copy]').textContent.trim() === 'Copy prompt'));

  // The master paragraph is on the page already, so the footer every skill
  // prompt ends with is checked against the page's own copy of it.
  const footer = document.getElementById('masterPromptParagraph').textContent;
  const results = OLD_SKILL_PROMPTS.map(([name, opening], index) => {
    const li = items[index];
    const source = document.getElementById(li.querySelector('button[data-copy]').getAttribute('data-copy'));
    const text = source ? source.textContent : '';
    return {
      name,
      nameShown: li.querySelector('.skill-prompt-name').textContent.trim() === name,
      opens: text.startsWith(opening),
      ends: text.endsWith('\n\n' + footer),
    };
  });
  check('the skills are listed in the old page order',
    results.every((r) => r.nameShown), results.filter((r) => !r.nameShown).map((r) => r.name));
  check('each copy button carries the prompt for its own skill',
    results.every((r) => r.opens), results.filter((r) => !r.opens).map((r) => r.name));
  check('and every prompt still ends with the master paragraph, as it did before',
    results.every((r) => r.ends), results.filter((r) => !r.ends).map((r) => r.name));

  check('the prompts are out of the way until asked for',
    items.every((li) => document.getElementById(li.querySelector('button[data-copy]').getAttribute('data-copy')).hidden));
  check('the old skill cards and ZIP downloads did not come back with them',
    !/\/downloads\//.test(document.body.innerHTML) && !/Download skill/.test(document.body.textContent));
}

// The two prompts the brief supplies, checked whole rather than by fingerprint:
// they are the product here, and a silent truncation would not show up anywhere else.
const NOTETAKER_PROMPT = [
  "You are my content producer. Read my call notes once and pull out three things in the same pass: who my ideal client is, the stories worth telling and the ideas worth posting.",
  "",
  "Sources: my AI notetaker calls (Granola or whichever is connected) from the last 90 days. If no notetaker is connected, ask me to paste 3 to 5 transcripts. Keep client, prospect, coaching, workshop and community calls. Skip team syncs, admin, vendor demos and personal notes. Show me the kept and skipped lists and ask \"Right calls?\" before you start.",
  "",
  "Before you start:",
  "Restate my goal in one line, and tell me if it's the right goal.",
  "Don't assume. If you need context the calls can't give, ask me one question at a time.",
  "",
  "From each call, capture:",
  "1. Ideal client evidence: who they are, what made them reach out now, every problem they named, what they already tried, their exact words for the problem and the goal, what they only hinted at, their objections, the win that would make them tell a friend, and who wasn't a fit. Cite the call for every line. Label guesses as guesses.",
  "2. Stories: something that happened, with a person, a moment, some tension and an outcome, that I could tell out loud in 60 seconds. Mine, or a client's with names removed.",
  "3. Ideas: a question others would ask too, an opinion against common advice, a framework, a stat or result, or a problem in the client's own words.",
  "",
  "A finding from 3+ calls with different people is strong. One call is weak.",
  "",
  "Never invent. Every detail must come from my calls. Never include client names, company names or confidential numbers. Write \"a founder I work with\" instead.",
  "",
  "Give me:",
  "My ideal client in one line: [role] at [stage] who [trigger] and is stuck on [problem #1]. Then the full profile, with the top 3 problems in their words.",
  "Then ask me what I want to be known for, the 3 to 5 topics I want to own, and what I will never post about.",
  "Keep only stories and ideas that hit a top-3 problem, the trigger, an objection or the win, and that a thousand creators aren't already posting. Max 5 stories and 10 ideas.",
  "Two tables, stories first: Title (a hook, first person, max 12 words) | Priority (High, Medium, Low) | Date | Why it lands with my client. The ideas table adds a Category column.",
  "The one story to post first, and why.",
  "",
  "Put the tables first and skip the intro.",
  "",
  "When you finish:",
  "Rate your work out of 10. Say what would make it a 10, then fix it.",
  "Push back on me: where is my ideal client different from what I think?",
  "Tell me what you learned about me that should be saved to my Context page, so you're smarter next time."
].join('\n');
const STORY_BANK_PROMPT = [
  "You are my story producer. Find the real stories I already tell and bank them so I can use them again on stage, in posts and on sales calls.",
  "",
  "Look through the last 90 days of my material: call transcripts (Granola or my AI note-taker), voice notes, podcast transcripts, LinkedIn posts and newsletters. Tell me in one line which sources you searched and which weren't available.",
  "",
  "Before you start:",
  "Restate my goal in one line, and tell me if it's the right goal.",
  "Don't assume. If you need more context, ask me up to 3 questions first.",
  "",
  "A story is one specific moment with a before, a turning point and an after. A career summary or an opinion is not a story. Look for moments with a date, place, person or number, lines like \"I'll never forget\" or \"the moment I realised\", stories I tell more than once, and moments where a listener reacted.",
  "",
  "Never invent. Every detail must come from my material. If something is missing, leave it blank and ask me.",
  "",
  "For each story, give me one table row with these columns:",
  "Story Name | The Hook (one line, in my words) | Type | Status | Takeaway | Question it answers | Conflict | Resolution | How I fit in | Times told | Audience evidence | Next place to tell it | Source",
  "",
  "Types: Badass (I backed myself and it worked), Party (I love telling it), Tough (not ready: a wound, not a scar), Shit to Shift (something bad forced the breakthrough), Core Story (how I got here).",
  "Status: Banked, Testing, or Needs detail.",
  "If a story is Tough, mark it \"Hold\" and don't suggest telling it publicly yet.",
  "Leave out anything confidential about clients, deals or other people, and list it under \"Held back\".",
  "",
  "Then give me:",
  "A table of questions people ask me, each with my go-to story and the takeaway I land.",
  "For every \"Needs detail\" story, the one question you need me to answer.",
  "",
  "Put the table first and skip the intro.",
  "",
  "When you finish:",
  "Rate your work out of 10. Say what would make it a 10, then fix it.",
  "Push back on me: which stories are weaker than I think, what's missing, what could go wrong if I tell one too early?",
  "Tell me the one story to tell next, and where.",
  "Tell me what you learned about me that should be saved to my Context page, so you're smarter next time."
].join('\n');

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
  check('and it copies the prompt word for word',
    document.getElementById(copy.getAttribute('data-copy')).textContent === NOTETAKER_PROMPT);

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
  check('its button copies the prompt word for word',
    copy.textContent.trim() === 'Copy the prompt' &&
    document.getElementById(copy.getAttribute('data-copy')).textContent === STORY_BANK_PROMPT);

  check('the Prompts row no longer counts its prompts',
    document.getElementById('prompts').querySelector('.row-sub').textContent.trim() === 'Prompts worth saving.',
    document.getElementById('prompts').querySelector('.row-sub').textContent.trim());
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
