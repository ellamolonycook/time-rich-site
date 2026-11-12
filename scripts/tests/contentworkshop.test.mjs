// /contentworkshop, the public guide to building a content system.
//
// Ella, 11 Nov: "Please update timerich.ai/contentworkshop to have the same
// flow that is in Week 3 but for the public." So the New York build night and
// its LinkedIn draw are gone and the page is an evergreen guide: three steps,
// twelve tickable rows, every code, prompt and link on the page.
//
// It was ported by hand from a design-tool export, so the first rule it pins
// is that nothing from that export leaked through: no {{hole}}, no <sc-for>,
// no /_blob/ image that would 404 on the site. The rest is run for real in
// jsdom, because the page's own inline script is what wires every copy
// button and tick, and a stale code on a public page is a worse failure
// than a stale page.
import { JSDOM } from 'jsdom';
import { readFileSync, existsSync } from 'node:fs';

const HTML = readFileSync(new URL('../../contentworkshop/index.html', import.meta.url), 'utf8');

// Every copy button the page carries, by the data-copy key it wears.
const COPY_KEYS = ['wispr', 'stanley', 'p1', 'p3', 'sk', 'p2', 'p4'];

// The rows, step by step, in the order the brief lists them.
const ROWS = {
  1: ['w1', 's1', 's2', 's3'],
  2: ['p1', 'p3', 'b1'],
  3: ['sk', 'p2', 'p4', 'r1', 'x1']
};
const TOTAL_ROWS = Object.values(ROWS).reduce((n, r) => n + r.length, 0);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

/** A fresh page with its inline script run, plus the clipboard it reaches for.
 *  `store` is the backing object behind localStorage, so a test can hand the
 *  page a guide already half ticked off, or read back what it saved. */
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

/** What a visitor can actually read: the body with the inline script and the
 *  stylesheet taken out. jsdom counts script text as body text, and a code
 *  comment about the page's history is not something anyone reads. */
function visibleText(document) {
  const clone = document.body.cloneNode(true);
  [...clone.querySelectorAll('script, style')].forEach((n) => n.remove());
  return clone.textContent.replace(/\s+/g, ' ');
}

const clickCopy = (document, key) =>
  document.querySelector('[data-copy="' + key + '"]').dispatchEvent(
    new document.defaultView.MouseEvent('click', { bubbles: true }));

const clickOn = (document, el) =>
  el.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));

/** A file the page points at, resolved from the repo root for an absolute
 *  src and from contentworkshop/ for a relative one. */
const fileFor = (src) => new URL(
  (src.startsWith('/') ? '../..' + src : '../../contentworkshop/' + src), import.meta.url);

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
  check('has the favicon other pages use',
    HTML.includes('/rocketship-icon-32.png'));
  check('off-white #FFFDFB ground, as on /accelerator', HTML.includes('#FFFDFB'));

  // The page is public now, so it has to be indexable -- and it has to stay
  // indexable after the script has run, which is where the guard lives.
  check('the markup carries no robots meta at all',
    !/name="robots"/.test(HTML));
  check('and the page is not noindex once the script has run',
    document.querySelector('meta[name="robots"]') === null,
    (document.querySelector('meta[name="robots"]') || {}).content);
  check('the noindex guard is still there for the next open answer',
    /var OPEN = \[\];/.test(HTML) && /content', 'noindex'/.test(HTML));

  const desc = (sel) => (document.querySelector(sel) || {}).content || '';
  const WANT = 'Everything you need to build your content system with Stanley and Wispr Flow: ' +
    'every code, prompt and link. Set up, then three steps.';
  check('the meta description is the one Ella wrote',
    desc('meta[name="description"]') === WANT, desc('meta[name="description"]'));
  check('and the og description, which is what a share card reads, matches it',
    desc('meta[property="og:description"]') === WANT, desc('meta[property="og:description"]'));
  check('the Twitter card is set up to fall back to the og description',
    desc('meta[name="twitter:card"]') === 'summary_large_image' &&
    document.querySelector('meta[name="twitter:description"]') === null);
}

console.log('\n/contentworkshop — the hero is the public guide, not a build night');
{
  const { document } = load();
  const hero = document.querySelector('h1');
  check('the h1 is "Build your content system."',
    hero.textContent.trim() === 'Build your content system.', hero.textContent.trim());
  check('the eyebrow says it is a free guide',
    /Free guide · Time Rich/.test(hero.parentElement.textContent));
  check('the sub-head puts the setup before the session',
    /Set up Stanley and Wispr Flow before the session, then build your content strategy and draft a week of posts\./
      .test(hero.parentElement.querySelector('p').textContent),
    hero.parentElement.querySelector('p').textContent.trim());
  check('and still says to tick each step off',
    /Tick each step off as you go\./.test(hero.parentElement.querySelector('p').textContent));
  check('Ella and the two partners are still named at the top',
    /Hosted by Ella Molony Cook\. Powered by/.test(visibleText(document)));
}

console.log('\n/contentworkshop — the build night, the draw and the winners are gone');
{
  const { document } = load();
  const text = visibleText(document);

  for (const [what, re] of [
    ['tonight', /tonight/i],
    ['the live build night', /build night|live build/i],
    ['New York as a venue', /Live build night · New York|all night/i],
    ['the old Thursday deadline', /thursday/i],
    ['the old "Winners announced" wording', /winners announced/i],
    ['an Accelerator seat to win', /seat to win|win 1 seat|1 seat in the/i],
    ['the person next to you', /person next to you/i],
    ['waving at a host', /wave at a host/i],
    ['being led by Ella', /Led by Ella/i],
    ['after tonight', /after tonight/i]
  ]) {
    check('no mention of ' + what, !re.test(text), (text.match(re) || [])[0]);
  }

  check('the sticky announcement bar is gone',
    !HTML.includes('class="annc"') && document.getElementById('anncwhen') === null);
  check('the "Win 1 seat" box, the second form and their ids are gone',
    ['win', 'winh', 'winnerswhen', 'vipprize', 'vipwhen']
      .every((id) => document.getElementById(id) === null) &&
    !HTML.includes('is-dark'));
  check('and so is the old prize line',
    !/VIP setup|Stanley Premium|12 months of Wispr Flow Pro|1,000|1,297/.test(HTML),
    (HTML.match(/.{0,40}(VIP setup|Stanley Premium|1,297).{0,40}/) || [])[0]);
  check('WORKSHOP.winnersWhen is gone, and nothing reads it',
    !/winnersWhen/.test(HTML));
  check('the laptop-and-charger checklist is gone',
    !/Laptop and charger/.test(HTML) && document.getElementById('setuplist') === null);
  check('and "Before you start" is gone with it',
    !/BEFORE YOU START/.test(HTML) && document.getElementById('step-0') === null);
  check('the funnel topic tabs and the ritual cards are gone',
    document.getElementById('funneltabs') === null &&
    document.getElementById('ritualcards') === null);
}

console.log('\n/contentworkshop — each step says when to do it');
{
  const { document } = load();
  const boxes = [...document.querySelectorAll('details.stepbox')];
  check('all three steps carry a timing chip',
    boxes.every((b) => b.querySelector('.stepkicker .steptiming') !== null));
  check('and they are the three Ella set, in order',
    boxes.map((b) => b.querySelector('.steptiming').textContent).join(' | ') ===
      'Before the session | Before or after the session | After the session',
    boxes.map((b) => b.querySelector('.steptiming').textContent));
  check('the chip sits above the step title, not after it',
    boxes.every((b) => (b.querySelector('.steptiming')
      .compareDocumentPosition(b.querySelector('.steptitle')) & 4) !== 0));

  const when = (n) => ((document.querySelector('#step-' + n + ' .stepwhen') || {}).textContent || '')
    .replace(/\s+/g, ' ').trim();
  check('Step 1 says to arrive with both tools set up and connected',
    when(1) === 'Come to the session with Stanley and Wispr Flow set up and connected.',
    when(1));
  check('Step 2 says the interview is not done on the call',
    when(2) === 'This one\u2019s an interview, about 10 minutes, and we don\u2019t do it on ' +
      'the call. Get ahead before the session, or finish it after.',
    when(2));
  check('Step 3 needs no extra line: the chip says it', when(3) === '', when(3));

  // Ella, 11 Nov: the session time belongs with the draw, nowhere else. No
  // Zoom link and no other date on the page.
  const text = visibleText(document);
  check('the page names no Zoom link',
    !/zoom\.us|zoom link/i.test(text), (text.match(/.{0,30}zoom.{0,30}/i) || [])[0]);
  check('and no time of day anywhere',
    !/\d\s?(am|pm)\b/i.test(text), (text.match(/.{0,30}\d\s?[ap]m\b.{0,30}/i) || [])[0]);
  check('the only date on the page is the draw date',
    (text.match(/\b\d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December)\b/g) || [])
      .join(',') === '16 November',
    (text.match(/\b\d{1,2} [A-Z][a-z]+\b/g) || []));
}

console.log('\n/contentworkshop — the draw: win a spot in the next Accelerator');
{
  const { document } = load();
  const card = document.getElementById('enter');
  const forms = [...document.querySelectorAll('form')];

  check('there is exactly one draw form', forms.length === 1, forms.length);
  check('it lives in its own card', card !== null && card.contains(forms[0]));
  check('the card sits after the start card and before Step 1',
    (document.getElementById('start').compareDocumentPosition(card) & 4) !== 0 &&
    (card.compareDocumentPosition(document.getElementById('step-1')) & 4) !== 0);
  check('it is not a tickable row, so it never counts toward the progress',
    card.querySelector('[data-item]') === null &&
    document.querySelectorAll('[data-item]').length === TOTAL_ROWS);

  check('the eyebrow reads "Win a spot"',
    card.querySelector('.drawkicker').textContent.trim() === 'Win a spot',
    card.querySelector('.drawkicker').textContent);
  check('the title is the spot in the next Accelerator',
    document.getElementById('enterh').textContent.trim() ===
      'Win a spot in the next Superhuman Accelerator',
    document.getElementById('enterh').textContent);
  check('the ask is a LinkedIn post tagging all three',
    card.querySelector('p').textContent.replace(/\s+/g, ' ').trim() ===
      'Post on LinkedIn about building your content system, tag Ella Molony Cook, ' +
      'Stanley and Wispr Flow, then paste your post link below. ' +
      'Winner drawn Monday 16 November.',
    card.querySelector('p').textContent.replace(/\s+/g, ' ').trim());
  check('Ella is the only link in that line, and it is her LinkedIn',
    [...card.querySelectorAll('p a')].map((a) => a.getAttribute('href')).join(',') ===
      'https://www.linkedin.com/in/ellamolonycook/' &&
    card.querySelector('p a').textContent === 'Ella Molony Cook',
    [...card.querySelectorAll('p a')].map((a) => a.getAttribute('href')));

  // The prize is a spot and nothing else: no dollar figure in the card.
  check('no price is named in the draw card',
    !/\$/.test(card.textContent), (card.textContent.match(/.{0,30}\$.{0,30}/) || [])[0]);

  check('the fields are the ones the worker files',
    [...forms[0].elements].filter((el) => el.name).map((el) => el.name).join(',') ===
      'Name,Email,LinkedIn post,_gotcha',
    [...forms[0].elements].filter((el) => el.name).map((el) => el.name));
  check('the labels read as Ella wrote them',
    [...forms[0].querySelectorAll('label span')].map((n) => n.textContent).join(' \u00b7 ') ===
      'Your name \u00b7 Email \u00b7 LinkedIn post URL',
    [...forms[0].querySelectorAll('label span')].map((n) => n.textContent));
  check('the LinkedIn field shows the shape of the link it wants',
    forms[0].querySelector('[name="LinkedIn post"]').getAttribute('placeholder') ===
      'https://www.linkedin.com/posts/...');
  check('the button says Enter the draw',
    forms[0].querySelector('button').textContent.trim() === 'Enter the draw',
    forms[0].querySelector('button').textContent);
  check('the honeypot is there and hidden from everyone',
    forms[0].querySelector('[name="_gotcha"]') !== null &&
    forms[0].querySelector('[name="_gotcha"]').classList.contains('drawtrap') &&
    forms[0].querySelector('[name="_gotcha"]').getAttribute('aria-hidden') === 'true' &&
    /\.drawtrap \{[^}]*left: -9999px/.test(HTML));
  check('it posts to the forms worker, unchanged',
    HTML.includes("'https://time-rich-forms.timerich.workers.dev/draw-entry'"));
  check('the message line is a live region, so a screen reader hears it',
    forms[0].querySelector('.drawmsg').getAttribute('role') === 'status' &&
    forms[0].querySelector('.drawmsg').getAttribute('aria-live') === 'polite');

  // One constant for the date, read everywhere it shows.
  check('the draw date lives in one constant',
    /var DRAW = \{ when: 'Monday 16 November' \};/.test(HTML));
  check('and the card reads it from there',
    document.getElementById('drawwhen').textContent === 'Monday 16 November',
    document.getElementById('drawwhen').textContent);
  check('the success message reads it from the same place, not a second copy',
    /Winner drawn ' \+ DRAW\.when \+ '\./.test(HTML));
}

console.log('\n/contentworkshop — the draw form says no before it sends');
{
  const { document } = load();
  const form = document.querySelector('form[data-drawform]');
  const msg = form.querySelector('.drawmsg');
  const field = (name) => form.querySelector('[name="' + name + '"]');
  const submit = () => form.dispatchEvent(
    new document.defaultView.Event('submit', { bubbles: true, cancelable: true }));

  // jsdom has no fetch here, so every path below has to stop at validation.
  // That is the point: nothing leaves the page until all three are good.
  submit();
  check('an empty name is caught', msg.textContent === 'Add your name.', msg.textContent);
  check('and marked as an error', msg.classList.contains('is-err'));

  field('Name').value = 'Ada Lovelace';
  submit();
  check('a missing email is caught',
    msg.textContent === 'Add a valid email so we can reach you if you win.', msg.textContent);

  field('Email').value = 'not-an-email';
  submit();
  check('and so is one that is not an address',
    msg.textContent === 'Add a valid email so we can reach you if you win.', msg.textContent);

  field('Email').value = 'ada@example.com';
  field('LinkedIn post').value = 'https://example.com/my-post';
  submit();
  check('a link that is not LinkedIn is turned away',
    msg.textContent ===
      'Paste the link to your LinkedIn post, like https://www.linkedin.com/posts/...',
    msg.textContent);
  check('the button was never disabled, so they can fix it and try again',
    form.querySelector('button').disabled === false);
}

console.log('\n/contentworkshop — no Club-only content leaked onto the public page');
{
  const { document } = load();
  const text = visibleText(document);
  const prompts = document.getElementById('strategyprompt').textContent + '\n' +
    document.getElementById('creatorsprompt').textContent;

  for (const [what, re] of [
    ['COMPASS', /compass/i],
    ['the Business Hub', /business hub/i],
    ['replays of Club calls', /#audacious-wins|#timerichclub/i],
    ['Founding Member notes', /founding member note/i]
  ]) {
    check('the page never mentions ' + what, !re.test(text), (text.match(re) || [])[0]);
  }

  check('neither prompt mentions COMPASS', !/compass/i.test(prompts));
  check('neither prompt mentions the Business Hub', !/business hub/i.test(prompts));
  check('no ViKA or Monday-of-the-week wording either',
    !/\bvika\b/i.test(text), (text.match(/.{0,40}vika.{0,40}/i) || [])[0]);
}

console.log('\n/contentworkshop — the page reads top to bottom in the order Ella set');
{
  const { document } = load();
  const order = ['h1', '#essentials', '#start', '#enter', '#step-1', '#step-2', '#step-3',
    '#hostsh', '#community'];
  const nodes = order.map((sel) => document.querySelector(sel));
  check('every landmark is on the page', nodes.every(Boolean), order.filter((s, i) => !nodes[i]));
  check('and each one comes after the one before it',
    nodes.every((n, i) => i === 0 ||
      (nodes[i - 1].compareDocumentPosition(n) & 4) !== 0),
    order);

  const bonus = [...document.querySelectorAll('summary')]
    .find((s) => /Stanley video guides/.test(s.textContent));
  check('the Stanley video guides row sits between Step 3 and Meet Ella',
    bonus !== undefined &&
    (document.getElementById('step-3').compareDocumentPosition(bonus) & 4) !== 0 &&
    (bonus.compareDocumentPosition(document.getElementById('hostsh')) & 4) !== 0);

  check('the hosts section still introduces Ella alone',
    /Meet Ella$/.test((document.getElementById('hostsh') || {}).textContent || ''));
  check('the Club section is headed "Keep going", not "After tonight"',
    /Keep going/.test(document.getElementById('community').parentElement.textContent) &&
    document.getElementById('community').textContent.trim() === 'Join the Time Rich Club');
  check('and both Club prices are untouched',
    HTML.includes('$77 ') && HTML.includes('$350 ') &&
    HTML.includes('Increasing to $650 p.a'));
  check('the two WhatsApp communities are still there',
    [...document.querySelectorAll('a[href*="chat.whatsapp.com"]')].length === 2);
  check('the partners footer is still there',
    /Partners/.test(visibleText(document)) &&
    HTML.includes('Follow Ella Molony Cook'));
}

console.log('\n/contentworkshop — the "Building your AI content machine" card');
{
  const { document } = load();
  const card = document.getElementById('start');
  check('the start-here card is a plain section, not a dropdown',
    card !== null && card.tagName === 'SECTION', card && card.tagName);
  check('it is titled "Building your AI content machine"',
    document.getElementById('starth').textContent.trim() ===
      'Building your AI content machine',
    document.getElementById('starth').textContent);
  check('and the old title is gone',
    !/What you(’|')ll leave with/i.test(HTML));
  check('and lists the three things, word for word',
    [...card.querySelectorAll('li')].map((n) => n.textContent).join('|') ===
    ['Your content strategy, saved in Stanley',
      '5 creators to study',
      'A week of LinkedIn posts drafted in your voice'].join('|'),
    [...card.querySelectorAll('li')].map((n) => n.textContent));
  check('with the line about which step happens when',
    /Step 1 before the session\. Steps 2 and 3 before or after: each one feeds the next\./
      .test(card.textContent), card.textContent.replace(/\s+/g, ' ').trim().slice(-90));
}

console.log('\n/contentworkshop — the essentials, and the two codes');
{
  const { document } = load();
  check('the label is "Your essentials", not "Tonight\'s essentials"',
    document.getElementById('essentials').textContent.trim() === 'Your essentials',
    document.getElementById('essentials').textContent.trim());
  check('the Wispr code on the page is TIMERICH90',
    document.getElementById('wisprcode').textContent === 'TIMERICH90',
    document.getElementById('wisprcode').textContent);
  check('the Stanley code on the page is STANLEY1MONTH',
    document.getElementById('stanleycode').textContent === 'STANLEY1MONTH',
    document.getElementById('stanleycode').textContent);
  check('the Wispr offer reads 3 months Pro', HTML.includes('Wispr Flow &middot; 3 months Pro'));
  check('the Stanley offer reads 1 month free', HTML.includes('Stanley &middot; 1 month free'));
  check('no TIMERICH6 is left anywhere on the page',
    !HTML.includes('TIMERICH6'),
    (HTML.match(/.{0,40}TIMERICH6.{0,40}/g) || []));
  check('and no 6-month offer wording either',
    !/6 months/i.test(HTML), (HTML.match(/.{0,40}6 months.{0,40}/i) || [])[0]);
  check('the $0.00 line went with the old Stanley offer',
    !HTML.includes('$0.00') && !/100% off/.test(HTML),
    (HTML.match(/.{0,40}(\$0\.00|100% off).{0,40}/) || [])[0]);

  // Both "How to redeem" links used to point at "Before you start", which is
  // gone: Stanley is redeemed in Step 1 and Wispr Flow in Step 2.
  const redeem = [...document.querySelectorAll('a')]
    .filter((a) => /How to redeem/.test(a.textContent))
    .map((a) => a.getAttribute('href'));
  check('"How to redeem" points at Step 1 for both, which is where the setup is',
    redeem.join(',') === '#step-1,#step-1', redeem);
}

console.log('\n/contentworkshop — every Stanley link is the tracking link');
{
  const { document } = load();
  const STANLEY = 'https://x.getstanley.ai/r/mz4y9g';
  const links = [...document.querySelectorAll('a[href*="getstanley"]')];
  check('there is at least one Stanley link', links.length >= 1, links.length);
  check('and every one of them is the tracking link',
    links.every((a) => a.getAttribute('href') === STANLEY),
    links.map((a) => a.getAttribute('href')));
  check('no bare getstanley.ai URL is left anywhere in the markup',
    (HTML.match(/getstanley\.ai/g) || []).length === links.length,
    (HTML.match(/https?:\/\/[^"' ]*getstanley[^"' ]*/g) || []));
  check('"Go to Stanley" in the sign-up steps is that link',
    links.some((a) => /Stanley/.test(a.textContent) &&
      /Go to/.test(a.parentElement.textContent)));
  check('each opens in a new tab, marked sponsored',
    links.every((a) => a.getAttribute('target') === '_blank' &&
      /\bnoopener\b/.test(a.getAttribute('rel') || '') &&
      /\bsponsored\b/.test(a.getAttribute('rel') || '')),
    links.map((a) => a.getAttribute('rel')));
}

console.log('\n/contentworkshop — how Wispr Flow is described');
{
  const { document } = load();

  check('Wispr Flow is named as voice dictation and Notetaker',
    /Voice dictation and Notetaker/.test(HTML),
    (HTML.match(/.{0,40}Notetaker.{0,40}/) || [])[0]);

  const recording = HTML.match(/with everyone&rsquo;s OK/g) || [];
  check('and recording a call is asked for in their words, once',
    recording.length === 1, recording.length);

  // The memo row is the one place that asks for a recording, so the line has
  // to be on that row rather than loose somewhere on the page.
  const row = document.getElementById('wisprnotetaker');
  check('the line sits with the voice-memo row',
    row !== null && /with everyone’s OK/.test(row.textContent),
    row && row.textContent.replace(/\s+/g, ' ').trim());
  check('which also names the Notetaker rather than just "a recording"',
    row !== null && /Wispr Flow Notetaker/.test(row.textContent));
  // The essentials card names the product in Wispr Flow's own words ("Voice
  // dictation and Notetaker"); inside the steps it is always Wispr Flow Notetaker.
  check('the steps never say Notetaker without Wispr Flow in front of it',
    [1, 2, 3].every((n) => !/(?<!Wispr Flow )Notetaker/.test(
      document.getElementById('step-' + n).textContent.replace(/\s+/g, ' '))));
  check('Step 1 says how to turn on dictation, on Mac and Windows',
    /Hold <strong>fn<\/strong>, speak, let go/.test(HTML) &&
    /Ctrl \+ Opt/.test(HTML) && /Ctrl \+ Win/.test(HTML));

  // Wispr Flow asked for no mention of Granola on this page.
  check('Granola is not named anywhere on the page',
    !/granola/i.test(HTML), (HTML.match(/.{0,50}granola.{0,50}/i) || [])[0]);

  // The redeem steps, as Wispr Flow asked for them. Ella, 11 Nov: redeeming
  // Wispr Flow is setup, so it sits in Step 1 with Stanley, not in Step 2.
  const text = document.getElementById('step-1').textContent.replace(/\s+/g, ' ');
  check('the redeem steps say to install on a laptop, through the referral link',
    /Install Wispr Flow on your laptop through/.test(text),
    (text.match(/Install Wispr Flow[^.]*\./) || [])[0]);
  check('and that the code goes in Settings → Plans and Billing',
    /Settings → Plans and Billing/.test(text));
  check('at the promo link at the bottom',
    /Scroll to the very bottom and click the promo link/.test(text));
  check('for 3 months Pro',
    /Enter TIMERICH90 for 3 months Pro/.test(text),
    (text.match(/.{0,24}TIMERICH90.{0,24}/g) || []));
  check('it warns the code is desktop-only and useless to a paying customer',
    /The code only works in the desktop app, and does nothing if you already pay for Wispr\./.test(text));
  check('and it tells anyone without a laptop what to do instead',
    /No laptop\? Use the free phone app for now and add the code on your laptop later\./.test(text));

  // The one link out to Wispr Flow is the redeem page, same as the portal.
  const links = [...document.querySelectorAll('a[href*="wisprflow.ai"]')];
  check('the download link is the public partner page',
    links.length === 1 &&
    links[0].getAttribute('href') === 'https://wisprflow.ai/partner/timerich',
    links.map((a) => a.getAttribute('href')));
  check('and the old redeem-promo link is gone',
    !HTML.includes('redeem-promo'));
  check('and it opens in a new tab, marked sponsored',
    links.length === 1 && links[0].getAttribute('target') === '_blank' &&
    /\bnoopener\b/.test(links[0].getAttribute('rel') || '') &&
    /\bsponsored\b/.test(links[0].getAttribute('rel') || ''),
    links.length === 1 && links[0].getAttribute('rel'));
}

console.log('\n/contentworkshop — the build is three numbered dropdowns');
{
  const { document } = load();
  const boxes = [...document.querySelectorAll('details.stepbox')];

  check('there are exactly three steps', boxes.length === 3, boxes.length);
  check('and they are numbered in order',
    boxes.map((b) => b.id).join(',') === 'step-1,step-2,step-3',
    boxes.map((b) => b.id));
  check('each one is a real <details>, so it works without JavaScript',
    boxes.every((b) => b.tagName === 'DETAILS' && b.querySelector('summary') !== null));
  check('only Step 1 is open to begin with',
    boxes.filter((b) => b.open).map((b) => b.id).join(',') === 'step-1',
    boxes.filter((b) => b.open).map((b) => b.id));

  const titles = boxes.map((b) => b.querySelector('.steptitle').textContent.trim());
  check('the three titles are the ones from Week 3',
    titles.join(' | ') === 'Set up Stanley and your content home | ' +
      'Build your content strategy | Run your content machine',
    titles);
  const kickers = boxes.map((b) =>
    b.querySelector('.stepkicker').firstChild.textContent.trim());
  check('and they are kicked off as Step 1, 2 and 3',
    kickers.join(',') === 'Step 1,Step 2,Step 3', kickers);

  const leads = boxes.map((b) => b.querySelector('.steplead').textContent.trim());
  check('Step 1 leads with what Stanley is, and the free month',
    /^Stanley is your AI head of content: a voice note goes in, drafts in your voice come out, you approve, it posts\. Free for 1 month with code STANLEY1MONTH\.$/
      .test(leads[0]), leads[0]);
  check('Step 2 leads with the 10-minute strategy',
    /^Tell AI who you are and who you serve, and it turns that into your content strategy in about 10 minutes\.$/
      .test(leads[1]), leads[1]);
  check('Step 3 leads with one hour of talking',
    /^One hour of talking\. 20 to 50 pieces of content\.$/.test(leads[2]), leads[2]);

  // Rows, step by step, in order.
  for (const n of [1, 2, 3]) {
    const keys = [...document.querySelectorAll('#step-' + n + ' [data-item]')]
      .map((b) => b.getAttribute('data-item'));
    check('Step ' + n + ' has its ' + ROWS[n].length + ' rows, in order',
      keys.join(',') === ROWS[n].join(','), keys);
  }

  const names = (n) => [...document.querySelectorAll('#step-' + n + ' .itemname')]
    .map((s) => s.textContent.replace(/\s+Optional$/, '').trim());
  check('Step 1 is the whole setup: both tools, then the optional MCP connector',
    names(1).join(' | ') === 'Redeem Wispr Flow (3 months Pro) | ' +
      'Sign up to Stanley (1 month free) | Connect your tools to Stanley | ' +
      'Use Stanley inside your current AI tool',
    names(1));
  check('and the Wispr Flow redeem is the first row of it',
    names(1)[0] === 'Redeem Wispr Flow (3 months Pro)' &&
    document.querySelector('#step-1 [data-item]').getAttribute('data-item') === 'w1',
    document.querySelector('#step-1 [data-item]').getAttribute('data-item'));
  check('Step 2 is the strategy, the creators and the Brain',
    names(2).join(' | ') === 'Build your content strategy | ' +
      'Find 5 industry leaders to study | Set up your Stanley Brain',
    names(2));
  check('Step 3 is the skill, the week, the memo, a ritual and the repurpose',
    names(3).join(' | ') === 'Add the LinkedIn skill to Stanley | ' +
      'Draft your week of posts | Turn one memo into a week of content | ' +
      'Switch on one ritual | Turn one post into many',
    names(3));

  check('only the MCP row is optional, and it says so',
    [...document.querySelectorAll('[data-item][data-opt]')]
      .map((b) => b.getAttribute('data-item')).join(',') === 's3' &&
    document.querySelector('[data-item="s3"] .itemopt') !== null);

  check('Step 1 holds the Wispr Flow redeem link, not Step 2',
    boxes[0].querySelector('a[href*="wisprflow.ai"]') !== null &&
    boxes[1].querySelector('a[href*="wisprflow.ai"]') === null);
  check('Step 2 holds the strategy prompt and its copy button',
    boxes[1].querySelector('#strategyprompt') !== null &&
    boxes[1].querySelector('[data-copy="p1"]') !== null);
  check('Step 2 holds the creators prompt and its copy button',
    boxes[1].querySelector('#creatorsprompt') !== null &&
    boxes[1].querySelector('[data-copy="p3"]') !== null);
  check('Step 3 holds the skill and its copy button',
    boxes[2].querySelector('#skilltext') !== null &&
    boxes[2].querySelector('[data-copy="sk"]') !== null);

  check('Step 1 closes with the note about your content home',
    /Your content home\./.test(boxes[0].querySelector('.stepnote').textContent) &&
    /Notion Content Hub/.test(boxes[0].querySelector('.stepnote').textContent));
  check('and that note links to the Club section on this page',
    boxes[0].querySelector('.stepnote a').getAttribute('href') === '#community',
    boxes[0].querySelector('.stepnote a').getAttribute('href'));

  // Ella's Loom of 4 Nov was her instructions to the team, not for members
  // (Gideon, 6 Nov), so it must not be on this page.
  check("Ella's internal Loom is not on the page",
    !HTML.includes('73d3636a71e14dfb9872d35c62f04e68'));
}

console.log('\n/contentworkshop — every row carries its own how-to');
{
  const { document } = load();
  const rows = [...document.querySelectorAll('[data-item]')];
  check('there are ' + TOTAL_ROWS + ' rows in all', rows.length === TOTAL_ROWS, rows.length);
  check('each row is followed by the panel that explains it',
    rows.every((r) => {
      const panel = r.parentElement.querySelector('.itempanel');
      return r.parentElement.tagName === 'LI' && panel !== null &&
        (r.compareDocumentPosition(panel) & 4) !== 0;
    }));
  check('each row says in one line what it is for',
    rows.every((r) => (r.querySelector('.itemhelp').textContent || '').length > 20),
    rows.map((r) => r.querySelector('.itemhelp').textContent.length));
}

console.log('\n/contentworkshop — the Looms, embedded and linked');
{
  const { document } = load();
  // The six Ella named, by the row each one belongs with.
  const WANT = [
    ['s1', 'be6db9ceb94344afb9b56244c9e517f2'],
    ['s2', '4d80c14f76b843389285aa391edea560'],
    ['s3', 'ba045aa4570f4c6abb7db97e59a12342'],
    ['b1', 'd2f889283f5e486f8d141803a81dba8e'],
    ['r1', 'c99bec0bc57c48d197e761a50e01ff88'],
    ['x1', '324de2dd44a249a78c83fa37b81a9a4f']
  ];

  for (const [key, id] of WANT) {
    const panel = document.querySelector('[data-item="' + key + '"]')
      .parentElement.querySelector('.itempanel');
    const frame = panel.querySelector('iframe');
    check('the ' + key + ' row embeds its Loom',
      frame !== null && frame.getAttribute('src').includes('loom.com/embed/' + id),
      frame && frame.getAttribute('src'));
    check('and offers it full screen on Loom too',
      [...panel.querySelectorAll('a')].some((a) =>
        a.getAttribute('href') === 'https://www.loom.com/share/' + id &&
        /Watch it full screen on Loom/.test(a.textContent)));
  }

  const frames = [...document.querySelectorAll('iframe')];
  check('every embed is lazy, full-screen capable and titled',
    frames.every((f) => f.getAttribute('loading') === 'lazy' &&
      f.hasAttribute('allowfullscreen') &&
      (f.getAttribute('title') || '').length > 10),
    frames.map((f) => f.getAttribute('title')));
  check('and every one sits inside a closed drop-down, so nothing loads unasked',
    frames.every((f) => f.closest('details') !== null &&
      f.closest('details').open === false));
  check('the six embeds are the six Looms, no more',
    frames.length === WANT.length, frames.length);
}

console.log('\n/contentworkshop — the Stanley video guides row');
{
  const { document } = load();
  const row = [...document.querySelectorAll('details.cw-acc')]
    .find((d) => /Stanley video guides/.test(d.querySelector('summary').textContent));
  check('the bonus row is still there, and still says 5 videos',
    row !== undefined && /5 short videos/.test(row.querySelector('summary').textContent));

  const links = [...row.querySelectorAll('a')];
  check('it lists the five Ella picked, in her order',
    links.map((a) => a.getAttribute('href').split('/share/')[1]).join(',') ===
    ['4d80c14f76b843389285aa391edea560', 'ba045aa4570f4c6abb7db97e59a12342',
      'd2f889283f5e486f8d141803a81dba8e', 'c99bec0bc57c48d197e761a50e01ff88',
      '324de2dd44a249a78c83fa37b81a9a4f'].join(','),
    links.map((a) => a.getAttribute('href')));
  check('each is named and says what it shows',
    links.map((a) => a.textContent).join(' | ') ===
    'Connectors | MCP connector | Keep the brain updated | Custom rituals | Post across platforms' &&
    /Connect Wispr Flow and your tools/i.test(row.textContent) &&
    /Plug Stanley into Claude or ChatGPT/i.test(row.textContent) &&
    /Every edit teaches it your voice/i.test(row.textContent) &&
    /Tasks it runs on repeat/i.test(row.textContent) &&
    /One idea, every platform/i.test(row.textContent),
    links.map((a) => a.textContent));
  check('each opens in a new tab, noopener',
    links.every((a) => a.getAttribute('target') === '_blank' &&
      /noopener/.test(a.getAttribute('rel') || '')));
  check('and the old Part 1 / Part 2 / Part 3 grouping is gone',
    !/Part 1: Get set up/.test(HTML));
}

console.log('\n/contentworkshop — the screenshots, on the page');
{
  const { document } = load();
  const shots = [...document.querySelectorAll('figure.shot')];

  check('five screenshots are drawn', shots.length === 5, shots.length);
  check('they are the five files Ella named, in order',
    shots.map((f) => f.querySelector('img').getAttribute('src')).join(',') ===
    ['/portal/assets/week3-stanley-flow.png',
      '/portal/assets/visibility-stanley-connectors.png',
      '/portal/assets/visibility-stanley-files.png',
      '/portal/assets/week3-content-waterfall.png',
      '/portal/assets/visibility-stanley-skills.png'].join(','),
    shots.map((f) => f.querySelector('img').getAttribute('src')));
  check('and every one of those files is actually in the repo',
    shots.every((f) => existsSync(fileFor(f.querySelector('img').getAttribute('src')))),
    shots.map((f) => f.querySelector('img').getAttribute('src'))
      .filter((s) => !existsSync(fileFor(s))));

  // A flow diagram belongs to its step; a screen of Stanley belongs to the
  // row that tells you to go to that screen.
  const inRow = shots.filter((f) => f.parentElement.classList.contains('itempanel'));
  check('the three screens of Stanley sit in the panel of the row they explain',
    inRow.length === 3 && inRow.every((f) => {
      const row = f.closest('li').querySelector('[data-item]');
      return row !== null && (row.compareDocumentPosition(f) & 4) !== 0;
    }), inRow.length);
  check('and the two flow diagrams sit at the top of their step, under the lead',
    shots.filter((f) => f.parentElement.classList.contains('stepbody')).length === 2);

  const imgs = shots.map((f) => f.querySelector('img'));
  check('each is lazy-loaded', imgs.every((i) => i.getAttribute('loading') === 'lazy'));
  check('each carries the alt text from the brief',
    imgs.map((i) => i.getAttribute('alt')).join(' | ') ===
    ['An AI head of content: from a voice note to a scheduled post',
      "Stanley's Connectors screen. Connected apps carry a green tick.",
      "Stanley's Brain panel",
      'One voice memo becomes a month of content',
      "Stanley's Brain panel with linkedin-content saved under Skills."].join(' | '),
    imgs.map((i) => i.getAttribute('alt')));
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
      const bytes = readFileSync(fileFor(i.getAttribute('src')));
      return bytes.subarray(1, 4).toString('latin1') === 'PNG' &&
        bytes.readUInt32BE(16) === Number(i.getAttribute('width')) &&
        bytes.readUInt32BE(20) === Number(i.getAttribute('height'));
    }),
    imgs.map((i) => {
      const bytes = readFileSync(fileFor(i.getAttribute('src')));
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

  // Hannah Zhang moved to Step 3, beside the LinkedIn skill she is talking about.
  const q = document.querySelector('#step-3 #hannahquote');
  check("Hannah Zhang's quote and photo sit with the LinkedIn skill",
    q !== null &&
    /Before, I would just use Claude for drafts\./.test(q.textContent) &&
    q.querySelector('img').getAttribute('src') === 'img/hannah-stanley.webp' &&
    existsSync(fileFor('img/hannah-stanley.webp')) &&
    (document.querySelector('[data-item="sk"]').compareDocumentPosition(q) & 4) !== 0);
}

console.log('\n/contentworkshop — the two prompts');
{
  const { document } = load();
  check('a WORKSHOP block holds them, one place for the long text',
    /var WORKSHOP\s*=\s*\{/.test(HTML) &&
    /strategyPrompt\s*:/.test(HTML) && /creatorsPrompt\s*:/.test(HTML));
  check('mikaPrompt is gone, and so is every trace of Mika',
    !/mikaPrompt/.test(HTML) &&
    !/mika|reyes|adeli/i.test(visibleText(document)),
    (visibleText(document).match(/.{0,40}(mika|reyes|adeli).{0,40}/i) || [])[0]);

  const strategy = document.getElementById('strategyprompt').textContent;
  const creators = document.getElementById('creatorsprompt').textContent;
  check('both are rendered into the page',
    strategy.length > 3000 && creators.length > 1500, [strategy.length, creators.length]);

  check('the strategy prompt opens with the 7 answers',
    strategy.startsWith('About me and my business: [say or paste your answers to the 7 questions above]'),
    strategy.slice(0, 80));
  check('it runs 6 sections, not 5',
    /we'll go through 6 short sections/.test(strategy) &&
    /"Section 2 of 6"/.test(strategy) &&
    /Section 6 · Your first week of posts/.test(strategy) &&
    !/Section 2 of 5/.test(strategy));
  check('it plans the first week of posts and repeats the Post block',
    /Repeat the Post block once per post\./.test(strategy) &&
    /Part 4 · Your first week of posts/.test(strategy));
  check('it ends with "Start now."',
    strategy.trim().endsWith('Start now.'), strategy.trim().slice(-30));
  check('it is written for founders, with no career options',
    /focused on founders building a business/.test(strategy) &&
    !/Growing my career|Pivoting my career/.test(strategy));

  check('the creators prompt starts from the worksheet in the chat',
    creators.startsWith('My Personal Branding worksheet is in this chat.'),
    creators.slice(0, 60));
  check('it lists the 6 creator types that make money',
    /Step 1 · The 6 creator types that make money/.test(creators) &&
    ['The Builder', 'The Teacher', 'The Storyteller', 'The Expert', 'The Curator', 'The Connector']
      .every((t) => creators.includes(t)));
  check('it picks 5 real creators and refuses to invent one',
    /Pick 5 real creators who post on LinkedIn or X/.test(creators) &&
    /Never make up a person, a link or how much someone earns\./.test(creators));
  check('and it lands in Stanley under Topics and Creators',
    /profile → Brain → Topics and Creators/.test(creators));
  check('it ends with "Start now." too',
    creators.trim().endsWith('Start now.'), creators.trim().slice(-30));

  check('no markdown # headings in either prompt or in the skill',
    !/^#/m.test(strategy) && !/^#/m.test(creators) &&
    !/^#/m.test(document.getElementById('skilltext').textContent));
  check('the strategy row says to save the worksheet as a Google Doc',
    /Save the worksheet as a Google Doc\./.test(document.getElementById('step-2').textContent));

  // The seven questions are Ella's, word for word, and they stay.
  check('the "What to say" list still carries all seven',
    document.querySelectorAll('#introprompts li').length === 7 &&
    [...document.querySelectorAll('#introprompts li')].map((n) => n.textContent).join('|') ===
    [
      'Who you are, and what your company does.',
      'What you want most from your content right now: customers, investors, hires or partners.',
      "What you've done that most people haven't: the results, the numbers, the companies you've built.",
      'What people always ask you about.',
      'Who your ideal customer is.',
      'What you could talk about for an hour, for free.',
      'A story from the last 2 weeks: a win, a mistake, or a customer conversation that stuck with you.',
    ].join('|'),
    [...document.querySelectorAll('#introprompts li')].map((n) => n.textContent));
  check('and the list is headed "What to say", with the intro wording gone',
    /What to say/.test(document.getElementById('introprompts').textContent) &&
    !/What to say in your intro/.test(HTML) && !/Keep it under 3 minutes/.test(HTML));
}

console.log('\n/contentworkshop — the three messages to Stanley');
{
  const { document } = load();
  check('the week of posts is drafted one at a time',
    document.getElementById('draftweek').textContent ===
    'Use my linkedin-content skill. Draft post 1 from "Your first week of posts" ' +
    'in my content strategy. When we finish, move to post 2.',
    document.getElementById('draftweek').textContent);
  check('the memo turns into 3 posts, a carousel and a reel script',
    document.getElementById('memoprompt').textContent ===
    "Here's my voice memo: [paste the transcript]. Using my content strategy, turn it into " +
    "3 LinkedIn posts, 1 carousel and 1 reel script, in my voice. Keep my words. " +
    "Add nothing that isn't in the memo.",
    document.getElementById('memoprompt').textContent);
  check('the skill is still the linkedin-content one, in full',
    document.getElementById('skilltext').textContent.startsWith('Create LinkedIn Content') &&
    document.getElementById('skilltext').textContent.length > 5000);
  check('"Stuck for a story?" offers the three funnel stages',
    (() => {
      const d = [...document.querySelectorAll('#step-3 details.cw-acc')]
        .find((x) => /Stuck for a story\?/.test(x.querySelector('summary').textContent));
      return d !== undefined && /Be discovered:/.test(d.textContent) &&
        /Be trusted:/.test(d.textContent) && /Be chosen:/.test(d.textContent);
    })());
  check('the ritual row names the Evening report, with no code unlock claim',
    /Evening report/.test(document.getElementById('step-3').textContent) &&
    !/code unlocks all of them/.test(HTML));
  check('and the repurpose row asks for 3 posts for X and a reel script',
    /Turn this into 3 posts for X and 1 reel script for Instagram/
      .test(document.getElementById('step-3').textContent));
}

console.log('\n/contentworkshop — the copy buttons');
{
  const { document } = load();
  for (const key of COPY_KEYS) {
    check('the ' + key + ' copy button exists',
      !!document.querySelector('[data-copy="' + key + '"]'));
  }
  check('there are no others', document.querySelectorAll('[data-copy]').length === COPY_KEYS.length,
    [...document.querySelectorAll('[data-copy]')].map((b) => b.getAttribute('data-copy')));
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
  check('and it is not stuck on Copied forever', HTML.includes('1600'));
  check('the idle label was not blank to begin with', idle.length > 0, idle);

  // Every button copies exactly what the page shows, character for character.
  for (const [key, sel] of [
    ['p1', '#strategyprompt'], ['p3', '#creatorsprompt'], ['sk', '#skilltext'],
    ['p2', '#draftweek'], ['p4', '#memoprompt']
  ]) {
    const before = copied.length;
    clickCopy(document, key);
    check('the ' + key + ' button copies the whole of ' + sel + ', not a summary',
      copied[before] === document.querySelector(sel).textContent,
      [key, (copied[before] || '').slice(0, 60)]);
  }
}

console.log('\n/contentworkshop — Open Claude / Open ChatGPT carry the strategy prompt');
{
  const { document, copied } = load();
  const prompt = document.getElementById('strategyprompt').textContent;
  const claude = document.querySelector('a[data-ai="claude"]');
  const gpt = document.querySelector('a[data-ai="chatgpt"]');
  check('there is an Open Claude button', !!claude && /Open Claude/.test(claude.textContent));
  check('there is an Open ChatGPT button', !!gpt && /Open ChatGPT/.test(gpt.textContent));
  check('both sit with the strategy prompt, in Step 2',
    claude.closest('#step-2') !== null && gpt.closest('#step-2') !== null);
  // The strategy prompt is about 6,000 characters, which encodes to more than
  // the 8,000-character ceiling the page keeps, so both buttons open a plain
  // new chat rather than a URL long enough to be refused. The click copies the
  // prompt and says so, which is what actually gets it into the box. Shorten
  // the prompt under the ceiling and the ?q= comes back on its own.
  check('the prompt is over the ceiling, so it cannot ride on a ?q=',
    encodeURIComponent(prompt).length > 8000, encodeURIComponent(prompt).length);
  check('Open Claude opens a plain new chat rather than a URL that would be refused',
    claude.href === 'https://claude.ai/new', claude.href);
  check('Open ChatGPT does the same',
    gpt.href === 'https://chatgpt.com/', gpt.href);
  check('neither link is anywhere near the ceiling',
    claude.href.length <= 8000 && gpt.href.length <= 8000, [claude.href.length, gpt.href.length]);
  check('and the fallback is the page\'s own rule, not a dropped feature',
    /var MAX_URL = 8000;/.test(HTML) &&
    /full\.length <= MAX_URL \? full : ai\.home/.test(HTML));
  check('both open in a new tab, noopener',
    [claude, gpt].every((a) => a.target === '_blank' && /noopener/.test(a.rel)));

  claude.addEventListener('click', (e) => e.preventDefault(), { once: true });
  claude.click();
  check('clicking also copies the prompt, in case an AI ignores ?q=', copied[0] === prompt);
  check('and it says so', /Prompt copied/.test((document.getElementById('cwtoast') || {}).textContent || ''));
  const p1row = document.querySelector('[data-item="p1"]');
  check('and ticks the strategy row', !!p1row && p1row.getAttribute('aria-pressed') === 'true');
}

console.log('\n/contentworkshop — each step is a checklist');
{
  const { document } = load();
  const box = (n) => document.getElementById('step-' + n);
  const items = (n) => [...box(n).querySelectorAll('[data-item]')];
  const countOf = (n) => box(n).querySelector('.stepcount').textContent;
  const badge = (n) => box(n).querySelector('.stepbadge').textContent;

  check('every row starts un-ticked',
    [1, 2, 3].every((n) => items(n).every((i) => i.getAttribute('aria-pressed') === 'false')));
  check('the header counts them, long and short',
    countOf(1) === '0 of 4 done0/4', countOf(1));
  check('and shows the step number while it is unfinished',
    badge(1) === '1' && box(1).getAttribute('data-done') === 'no', badge(1));

  // Every tap target is at least 44px, which on a page with no layout is
  // the declared rule rather than a measurement.
  check('the rows and the step headers are 44px tap targets',
    /\.itemrow\{[^}]*min-height:44px/.test(HTML) &&
    /\.stepsum\{[^}]*min-height:44px/.test(HTML));

  // Step 1 completes on its two required rows: the optional MCP one counts in
  // the header but is not in anyone's way.
  check('Step 2 is shut while Step 1 is unfinished', box(2).open === false);
  clickOn(document, items(1)[0]);
  clickOn(document, items(1)[1]);
  clickOn(document, items(1)[2]);
  check('the three required rows read 3 of 4', countOf(1) === '3 of 4 done3/4', countOf(1));
  check('and the step is done without the optional row',
    box(1).getAttribute('data-done') === 'yes' && badge(1) === '✓', badge(1));
  check('finishing a step opens the next one', box(2).open === true);
  clickOn(document, items(1)[3]);
  check('ticking the optional row too reads 4 of 4', countOf(1) === '4 of 4 done4/4', countOf(1));
  check('and leaves the step done', box(1).getAttribute('data-done') === 'yes');

  // Un-ticking takes it back, and does not shut the next step under anyone.
  clickOn(document, items(1)[0]);
  check('un-ticking a required row drops the step again',
    box(1).getAttribute('data-done') === 'no' && countOf(1) === '3 of 4 done3/4', countOf(1));
  check('and the step it opened stays open', box(2).open === true);

  // Step 3's five rows all count.
  items(3).forEach((el) => clickOn(document, el));
  check('all five Step 3 rows ticked completes it',
    box(3).getAttribute('data-done') === 'yes' && countOf(3) === '5 of 5 done5/5', countOf(3));
}

console.log('\n/contentworkshop — the copy buttons tick their own row');
{
  // Copying ticks one row, not the whole step: it is the same map of ticks
  // read a different way, so there is no second record of what is done.
  const { document } = load();
  const box = (n) => document.getElementById('step-' + n);
  const row = (key) => document.querySelector('[data-item="' + key + '"]');

  for (const [key, step] of [['p1', 2], ['p3', 2], ['sk', 3], ['p2', 3], ['p4', 3]]) {
    check('Step ' + step + ' has a row driven by the ' + key + ' copy button', row(key) !== null);
    clickCopy(document, key);
    check('copying ticks that row', row(key).getAttribute('aria-pressed') === 'true');
    check('and does not finish the step on its own',
      box(step).getAttribute('data-done') === 'no',
      box(step).querySelector('.stepcount').textContent);
  }
  check('the code buttons tick nothing: there is no row for a code',
    (() => {
      const before = document.getElementById('donecount').textContent;
      clickCopy(document, 'wispr');
      return document.getElementById('donecount').textContent === before;
    })());
}

console.log('\n/contentworkshop — the progress count, which counts rows');
{
  const { document } = load();
  const count = () => document.getElementById('donecount').textContent;

  check('the total is the number of rows on the page',
    document.getElementById('donetotal').textContent === String(TOTAL_ROWS) &&
    document.querySelectorAll('[data-item]').length === TOTAL_ROWS,
    document.getElementById('donetotal').textContent);
  check('starts at 0 done', count() === '0', count());

  const rows = [...document.querySelectorAll('[data-item]')];
  clickOn(document, rows[0]);
  check('one row ticked is 1 done', count() === '1', count());
  rows.slice(1).forEach((el) => clickOn(document, el));
  check('everything ticked reads exactly ' + TOTAL_ROWS + ', the total',
    count() === String(TOTAL_ROWS), count());
  check('every step badge in the top bar shows a tick',
    [...document.querySelectorAll('[data-badge]')].every((b) => b.textContent === '✓'),
    [...document.querySelectorAll('[data-badge]')].map((b) => b.textContent));
  check('and so does every dropdown header',
    [...document.querySelectorAll('.stepbadge')].every((b) => b.textContent === '✓'),
    [...document.querySelectorAll('.stepbadge')].map((b) => b.textContent));

  clickOn(document, rows[0]);
  check('un-ticking one takes the count back down', count() === String(TOTAL_ROWS - 1), count());
}

console.log('\n/contentworkshop — the step nav');
{
  const { document } = load();
  const dots = [...document.querySelectorAll('#stepnav a')];
  check('there are three step dots', dots.length === 3, dots.length);
  check('named for the three steps',
    dots.map((a) => a.querySelector('.stepshort').textContent).join(',') ===
      'Set up,Strategy,Content machine',
    dots.map((a) => a.querySelector('.stepshort').textContent));
  check('and each carries the badge that turns into a tick',
    dots.every((a) => a.querySelector('[data-badge]') !== null));
  check('each points at its own dropdown',
    dots.map((a) => a.getAttribute('href')).join(',') === '#step-1,#step-2,#step-3',
    dots.map((a) => a.getAttribute('href')));

  // A dot points at a box that may be shut, so following it opens it first.
  check('Step 3 is shut to begin with', document.getElementById('step-3').open === false);
  clickOn(document, dots[2]);
  check('clicking its dot opens it', document.getElementById('step-3').open === true);

  // So does "How to redeem" in the code cards. Both point at Step 1 now, which
  // is open on load, so shut it first or the check proves nothing.
  const redeem = [...document.querySelectorAll('a')].find((a) => /How to redeem/.test(a.textContent));
  document.getElementById('step-1').open = false;
  clickOn(document, redeem);
  check('and so does "How to redeem"', document.getElementById('step-1').open === true);
}

console.log('\n/contentworkshop — a refresh does not lose the work');
{
  const first = load();
  [...first.document.querySelectorAll('#step-1 [data-item]')]
    .forEach((el) => clickOn(first.document, el));
  check('four rows are ticked before the refresh',
    first.document.getElementById('donecount').textContent === '4',
    first.document.getElementById('donecount').textContent);
  check('and something was written to storage',
    Object.keys(first.store).length === 1, Object.keys(first.store));

  // The same storage, a brand new page: the refresh.
  const again = load(first.store);
  check('the ticks come back', again.document.getElementById('donecount').textContent === '4',
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
    document.querySelectorAll('details.stepbox').length === 3);
  check('and its prompts', document.getElementById('strategyprompt').textContent.length > 3000);
  [...document.querySelectorAll('#step-1 [data-item]')]
    .forEach((el) => clickOn(document, el));
  check('and ticking still works',
    document.getElementById('step-1').getAttribute('data-done') === 'yes' &&
    document.getElementById('donecount').textContent === '4',
    document.getElementById('donecount').textContent);
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
  check('the long prompt panels scroll rather than running off the page',
    /\.promptbox \.promptscroll\{max-height:340px;overflow-y:auto\}/.test(HTML));
  check('and a long prompt line wraps instead of scrolling sideways',
    /\.promptbox pre\{[^}]*white-space:pre-wrap/.test(HTML) &&
    /\.promptbox pre\{[^}]*overflow-wrap:anywhere/.test(HTML));
  check('the long timing chip drops to its own line on a phone',
    (() => {
      const at = HTML.indexOf('@container page (max-width: 420px)');
      const rule = HTML.indexOf('.steptiming{display:block', at);
      return at !== -1 && rule !== -1 && rule - at < 700;
    })());
  check('the step nav still collapses to badges on a narrow screen',
    /@container page \(max-width: 560px\)\{(?:[^{}]*\{[^{}]*\})*?\.stepshort\{display:none\}/.test(HTML));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
