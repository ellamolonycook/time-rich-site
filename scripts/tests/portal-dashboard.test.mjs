// The dashboard.
//
// The page is one question answered: what do I do next. The next step card
// answers it outright, the three tiles say what is coming and what is already
// paid for, and the list on the left is the same steps in full.
//
// What this suite pins is the behaviour that is easy to break by hand: the
// card shows the FIRST unticked step and moves on when that step is ticked,
// the countdown says the right thing on each side of kickoff, and nothing is
// drawn twice. The Join rule it shares with Live Sessions has its own suite
// (portal-join.test.mjs), which compares the two pages on one clock.
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const LIVE = read('portal/portal-live.js');
const HTML = read('portal/dashboard.html');
const RESOURCES = read('portal/resources.html');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

// Monday 26 October 2026, 12:00 ET.
const KICKOFF = '2026-10-26T16:00:00.000Z';
const session = (id, week, title, iso) => ({
  id, week_id: week, title, starts_at: iso,
  join_url: 'https://zoom.us/j/' + id, addevent_url: null, recording_url: null,
});

const SESSIONS = [
  session(1, 1, 'Open Business Surgery', KICKOFF),
  session(2, 1, 'Training Your Agent', '2026-10-30T16:00:00.000Z'),
  session(3, 2, 'Your AI Operating System', '2026-11-02T17:00:00.000Z'),
  session(4, 2, 'Expert Q&A', '2026-11-06T17:00:00.000Z'),
  session(5, 3, 'Storytelling for GTM', '2026-11-09T17:00:00.000Z'),
  session(6, 3, 'The AI Content Machine', '2026-11-13T17:00:00.000Z'),
  session(7, 4, 'Unfair AI Advantage', '2026-11-16T17:00:00.000Z'),
  session(8, 4, 'Networking Session', '2026-11-18T17:00:00.000Z'),
  session(9, 4, 'Q&A: Exited Founder', '2026-11-20T17:00:00.000Z'),
  session(10, 4, 'What Next', '2026-11-23T17:00:00.000Z'),
];

// Nine steps, which is more than the six the list shows, so the "+ N more"
// line has something to count.
const PREP = [
  { id: 4, kind: 'text', title: 'Welcome to the Superhuman Accelerator', body: 'Over the next 4 weeks.' },
  { id: 5, kind: 'link', title: 'Make your copy of the Business COMPASS', body: 'Click to make your own copy.', url: 'https://docs.google.com/document/d/x/copy' },
  { id: 30, kind: 'link', title: 'Install Wispr Flow', body: 'Six months of Pro.', url: 'https://wisprflow.ai' },
  { id: 40, kind: 'text', title: 'Turn it on', body: 'Hold fn on Mac.' },
  { id: 50, kind: 'text', title: 'Say it: One-liners', body: 'Hold fn and say.' },
  { id: 60, kind: 'text', title: 'Say it: Who I serve', body: 'Hold fn and say.' },
  { id: 70, kind: 'text', title: 'Say it: What I sell', body: 'Hold fn and say.' },
  { id: 120, kind: 'link', title: 'Answer the onboarding questions', body: 'Shapes the curriculum.', url: 'https://timerich.ai/superhuman/' },
  { id: 130, kind: 'link', title: 'Join the Superhuman WhatsApp group', body: 'Between sessions.', url: 'https://chat.whatsapp.com/abc' },
];

function payload({ doneIds = [], week1Open = false, week1Items = [], unlockedWeeks = [0] } = {}) {
  return {
    ok: true,
    member: { first_name: 'Ella', role: 'buyer', setup: { calendar: false, notion: false } },
    weeks: [0, 1, 2, 3, 4].map((id) => ({
      id,
      title: id === 0 ? 'Week 1: Start here' : 'Week ' + id,
      unlocked: id === 1 ? week1Open : unlockedWeeks.includes(id),
      release_at: '2026-10-26T04:00:00.000Z',
      items: id === 0 ? PREP : (id === 1 ? week1Items : []),
    })),
    sessions: SESSIONS,
    progress: { items: doneIds, sessions: [] },
  };
}

/* Pins a window's clock, so the countdown can be read on each side of
   kickoff. Calls that pass an argument still reach the real Date, or every
   starts_at would parse to the frozen time. */
function freeze(window, iso) {
  const Real = window.Date;
  const fixed = Date.parse(iso);
  function Frozen(...args) { return args.length ? new Real(...args) : new Real(fixed); }
  Frozen.prototype = Real.prototype;
  Frozen.now = () => fixed;
  Frozen.parse = Real.parse;
  Frozen.UTC = Real.UTC;
  window.Date = Frozen;
}

/* The real page, with the real renderer, driven the way portal-access.js
   drives it. saved[] records every write the Mark done button makes, so the
   test can prove it goes through the same TRPortal.setProgress every other
   tick on the site uses. */
function open({ data = payload(), now = '2026-10-17T12:00:00.000Z' } = {}) {
  const saved = [];
  const dom = new JSDOM(HTML, {
    url: 'https://timerich.ai/portal/dashboard.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),
    beforeParse(window) {
      window.tailwind = {};
      window.gtag = () => {};
      window.TR_PORTAL_CONFIG = { sessionUrl: 'https://worker.test/portal-session' };
      window.fetch = () => Promise.resolve(new globalThis.Response('{}', { status: 200 }));
      window.TRPortal = {
        setProgress: (target, value) => { saved.push({ ...target, value }); return Promise.resolve(true); },
        setSetup: () => Promise.resolve(true),
      };
      freeze(window, now);
      window.eval(LIVE);
    },
  });
  const w = dom.window;
  w.TRLive.setProgress(data);
  w.TR_PORTAL_DATA = data;
  w.document.dispatchEvent(new w.CustomEvent('trportal:data', { detail: data }));
  const doc = w.document;
  return {
    dom, w, doc, saved,
    q: (sel) => doc.querySelector(sel),
    all: (sel) => [...doc.querySelectorAll(sel)],
    step: () => doc.querySelector('[data-dash-step]'),
    stepTitle: () => (doc.querySelector('.trp-nextstep-title') || {}).textContent || null,
    stepTag: () => (doc.querySelector('.trp-nextstep .trp-tag') || {}).textContent || null,
    rows: () => [...doc.querySelectorAll('.trp-dstep')],
    rowNames: () => [...doc.querySelectorAll('.trp-dstep-name')].map((n) => n.textContent),
  };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

console.log('\nYour next step');
{
  const page = open();
  check('the card is shown', page.step().hidden === false && page.step().className.includes('trp-nextstep'));
  check('it names the first step, which nothing has ticked yet',
    page.stepTitle() === 'Welcome to the Superhuman Accelerator', page.stepTitle());
  check('and says where that sits in the list',
    page.stepTag() === 'Your next step · 1 of 9', page.stepTag());

  // The first two are ticked, so the card has to be on the third.
  const done = open({ data: payload({ doneIds: [4, 5] }) });
  check('a ticked step is skipped, not shown greyed out',
    done.stepTitle() === 'Install Wispr Flow', done.stepTitle());
  check('and the position counts the whole list, not what is left',
    done.stepTag() === 'Your next step · 3 of 9', done.stepTag());
  check('the counts beside it are the real ones',
    done.q('.trp-nextstep-count').textContent === '2 of 9 done',
    done.q('.trp-nextstep-count').textContent);
  check('with a bar that says the same thing to a screen reader',
    done.q('.trp-nextstep .trp-progress-track').getAttribute('aria-valuenow') === '2' &&
    done.q('.trp-nextstep .trp-progress-track').getAttribute('aria-valuemax') === '9');
  check('and the line from the brief under it',
    done.q('.trp-nextstep-note').textContent === 'Start here · finish before kickoff',
    done.q('.trp-nextstep-note').textContent);
}

console.log('\nYour next step: the two buttons');
{
  const page = open({ data: payload({ doneIds: [4] }) });
  const open1 = page.q('.trp-nextstep-acts a');
  check('a step with a url gets an Open button',
    Boolean(open1) && open1.textContent === 'Open' &&
    open1.getAttribute('href') === 'https://docs.google.com/document/d/x/copy',
    open1 && open1.getAttribute('href'));
  check('it opens in a new tab, safely',
    open1.getAttribute('target') === '_blank' &&
    open1.getAttribute('rel') === 'noopener noreferrer');

  // Step 4, "Turn it on", has a body and no url.
  const noUrl = open({ data: payload({ doneIds: [4, 5, 30] }) });
  check('a step with no url gets no Open button',
    noUrl.stepTitle() === 'Turn it on' &&
    noUrl.q('.trp-nextstep-acts a') === null, noUrl.stepTitle());
  check('but it still has Mark done, or the list could never move on',
    noUrl.q('.trp-nextstep-acts button').textContent === 'Mark done');
}

console.log('\nMark done moves the card on, without a reload');
{
  const page = open();
  check('it starts on the first step',
    page.stepTitle() === 'Welcome to the Superhuman Accelerator', page.stepTitle());

  page.q('.trp-nextstep-acts button').click();
  await settle();

  check('the write went through the usual TRPortal.setProgress',
    page.saved.length === 1 && page.saved[0].id === 4 &&
    page.saved[0].kind === 'item' && page.saved[0].value === true, page.saved);
  check('the card is now on the next unticked step',
    page.stepTitle() === 'Make your copy of the Business COMPASS', page.stepTitle());
  check('the position moved with it',
    page.stepTag() === 'Your next step · 2 of 9', page.stepTag());
  check('and the count went up',
    page.q('.trp-nextstep-count').textContent === '1 of 9 done',
    page.q('.trp-nextstep-count').textContent);
  check('the page was not reloaded: the same card element is still there',
    page.step().isConnected === true);

  // And again, to prove it is not a one-off.
  page.q('.trp-nextstep-acts button').click();
  await settle();
  check('a second tick advances it again',
    page.stepTitle() === 'Install Wispr Flow' &&
    page.q('.trp-nextstep-count').textContent === '2 of 9 done', page.stepTitle());

  // Ticking a row in the list on the left moves the card too: both read the
  // same progress, so neither can fall behind the other.
  const row = page.rows().find((r) => r.querySelector('.trp-dstep-name').textContent === 'Install Wispr Flow');
  row.querySelector('.trp-check-box').click();
  await settle();
  check('a tick in the list on the left moves the card as well',
    page.stepTitle() === 'Turn it on', page.stepTitle());
}

console.log('\nWhen everything is ticked');
{
  const page = open({ data: payload({ doneIds: PREP.map((i) => i.id) }) });
  check('the card says so in the words from the brief',
    page.stepTitle() === 'You’re ready for kickoff.', page.stepTitle());
  check('and offers the curriculum rather than a dead button',
    page.q('.trp-nextstep-go').getAttribute('href') === 'curriculum.html' &&
    page.q('.trp-nextstep-acts') === null);
  check('the count is full', page.q('.trp-nextstep-count').textContent === '9 of 9 done');
}

console.log('\nThe countdown pill');
{
  const pill = (now, data = payload()) => {
    const p = open({ data, now });
    const el = p.q('[data-dash-countdown]');
    return el.hidden ? null : el.textContent;
  };

  check('nine days before: the date and the days to go',
    pill('2026-10-17T12:00:00.000Z') === 'Kickoff Mon 26 Oct · 9 days to go',
    pill('2026-10-17T12:00:00.000Z'));
  check('the day before: one day, in the singular',
    pill('2026-10-25T12:00:00.000Z') === 'Kickoff Mon 26 Oct · 1 day to go',
    pill('2026-10-25T12:00:00.000Z'));

  // Eastern days, not the member's. 03:00 UTC on the 26th is still the 25th
  // in New York, so it is a day to go, not kickoff day.
  check('counted in Eastern days, so a member in Sydney sees what one in LA sees',
    pill('2026-10-26T03:00:00.000Z') === 'Kickoff Mon 26 Oct · 1 day to go',
    pill('2026-10-26T03:00:00.000Z'));
  check('kickoff morning, before the call: Kickoff today',
    pill('2026-10-26T13:00:00.000Z') === 'Kickoff today', pill('2026-10-26T13:00:00.000Z'));
  check('kickoff evening, after the call: still Kickoff today',
    pill('2026-10-26T23:00:00.000Z') === 'Kickoff today', pill('2026-10-26T23:00:00.000Z'));

  const open1 = payload({ week1Open: true, unlockedWeeks: [0, 1] });
  check('after kickoff it stops counting and says where the cohort is',
    pill('2026-10-28T12:00:00.000Z', open1) === 'Week 1 of 4',
    pill('2026-10-28T12:00:00.000Z', open1));
  const open3 = payload({ week1Open: true, unlockedWeeks: [0, 1, 2, 3] });
  check('and it follows the weeks that have opened',
    pill('2026-11-10T12:00:00.000Z', open3) === 'Week 3 of 4',
    pill('2026-11-10T12:00:00.000Z', open3));
  check('never Week 0 of 4, even the day after kickoff with nothing opened',
    pill('2026-10-27T12:00:00.000Z') === 'Week 1 of 4', pill('2026-10-27T12:00:00.000Z'));

  // No schedule, nothing to count from.
  const bare = { ...payload(), sessions: [] };
  check('with no sessions at all the pill is hidden rather than blank',
    pill('2026-10-17T12:00:00.000Z', bare) === null);
}

console.log('\nThe three tiles');
{
  const page = open();
  const tiles = page.all('.trp-dash-tiles > *').filter((n) => !n.hidden);
  check('three tiles, all showing', tiles.length === 3, tiles.length);

  // a. the next live session
  check('the first is the next live session',
    tiles[0].querySelector('.trp-next-title').textContent === 'Open Business Surgery',
    tiles[0].querySelector('.trp-next-title').textContent);
  check('with its date and time in Eastern',
    /MON 26 OCT|Mon 26 Oct/i.test(tiles[0].querySelector('.trp-next-when').textContent),
    tiles[0].querySelector('.trp-next-when').textContent);
  check('and the Join button, shut this far out, with the line under it',
    tiles[0].querySelector('button').disabled === true &&
    tiles[0].querySelector('.trp-join-note').textContent === 'Opens 30 minutes before the start.',
    tiles[0].querySelector('.trp-join-note').textContent);

  // b. sessions attended
  check('the second counts sessions attended, not materials',
    tiles[1].querySelector('.trp-tile-n').textContent === '0' &&
    tiles[1].querySelector('.trp-tile-of').textContent === 'of 10 sessions',
    tiles[1].querySelector('.trp-tile-of').textContent);
  check('with a bar and the way into the curriculum',
    tiles[1].querySelector('.trp-progress-track') !== null &&
    /Open curriculum/.test(tiles[1].querySelector('.trp-tile-go').textContent) &&
    tiles[1].querySelector('.trp-tile-go').getAttribute('href') === 'curriculum.html');

  // c. the partner offers
  const names = [...tiles[2].querySelectorAll('.trp-ptile-name')].map((n) => n.textContent);
  check('the third lists the three partners',
    names.join('|') === 'Stanley|Wispr Flow|LaunchLemonade', names);
  check('and sends people to Resources to claim them',
    /Claim in Resources/.test(tiles[2].querySelector('.trp-tile-go').textContent) &&
    tiles[2].querySelector('.trp-tile-go').getAttribute('href') === 'resources.html');

  // These used to be Resources' lines, checked word for word against that
  // page: two files, one set of words.
  //
  // They have different jobs now. The Resources cards carry numbered steps
  // for claiming each offer, so their line shrank to a strapline sitting
  // above those steps -- "Your AI head of content. The code goes in at
  // checkout." On the dashboard there are no steps and no room for any, so
  // this tile still has to say what the offer actually is in one sentence.
  //
  // So the two are pinned separately rather than against each other. The
  // drift this was written to catch is still caught; it is just caught in
  // two places. What must still agree is the offer itself, which is the
  // last block below.
  const lines = [...tiles[2].querySelectorAll('.trp-ptile-line')].map((n) => n.textContent);
  check('the tile says what each offer is, in one sentence',
    JSON.stringify(lines) === JSON.stringify([
      '6 months of Stanley free with code TIMERICH6. Your AI head of content: drafts from your calls, learns your voice, posts for you.',
      '6 months of Wispr Flow Pro, the voice dictation app the accelerator runs on.',
      '3 months of LaunchLemonade included.',
    ]), lines);

  // The wording is each page's own; the offer is not. If the length of a
  // deal or the code ever changes on one page and not the other, a member
  // reads one number here and a different one when they go to claim it.
  const resourcesDoc = new JSDOM(RESOURCES).window.document;
  const resourcesText = resourcesDoc.querySelector('[aria-labelledby="partners-heading"]').textContent;
  for (const term of ['6 months', 'TIMERICH6', '3 months']) {
    check('"' + term + '" is on both the dashboard tile and Resources',
      lines.join(' ').includes(term) === resourcesText.includes(term) &&
      resourcesText.includes(term),
      { dashboard: lines.join(' ').includes(term), resources: resourcesText.includes(term) });
  }
}

console.log('\nThe compact Start here list');
{
  const page = open({ data: payload({ doneIds: [4] }) });
  const list = page.q('[data-dash-list]');
  check('the list is shown, labelled Week 01 and Start here',
    list.hidden === false &&
    list.querySelector('.trp-tag').textContent === 'Week 01 · Start here',
    list.querySelector('.trp-tag').textContent);
  check('six rows, no more', page.rows().length === 6, page.rows().length);
  check('in the order the Curriculum shows them',
    page.rowNames().join('|') === PREP.slice(0, 6).map((i) => i.title).join('|'),
    page.rowNames());
  check('and the rest are counted, not dropped silently',
    page.q('.trp-dlist-more').textContent === '+ 3 more steps',
    page.q('.trp-dlist-more').textContent);
  check('with the way to the whole list',
    /See all in Curriculum/.test(page.q('.trp-dlist-go').textContent) &&
    page.q('.trp-dlist-go').getAttribute('href') === 'curriculum.html');

  // The one to do next is named, so it can be found without counting.
  const tagged = page.rows().filter((r) => r.querySelector('.trp-dstep-next'));
  check('exactly one row is tagged Next', tagged.length === 1, tagged.length);
  check('and it is the first unticked one, not the first row',
    tagged[0].querySelector('.trp-dstep-name').textContent === 'Make your copy of the Business COMPASS',
    tagged[0].querySelector('.trp-dstep-name').textContent);

  // A row is a title and a tick until it is opened.
  const row = page.rows()[1];
  const head = row.querySelector('.trp-dstep-head');
  const body = row.querySelector('.trp-dstep-body');
  check('a row starts closed, with its body out of the way',
    body.hidden === true && head.getAttribute('aria-expanded') === 'false');
  head.click();
  check('clicking the title opens it',
    body.hidden === false && head.getAttribute('aria-expanded') === 'true');
  check('and the body and the link are both in there',
    body.querySelector('.trp-dstep-text').textContent === 'Click to make your own copy.' &&
    body.querySelector('a').getAttribute('href') === 'https://docs.google.com/document/d/x/copy');
  head.click();
  check('clicking it again closes it', body.hidden === true);

  check('every row can be ticked', page.rows().every((r) => r.querySelector('.trp-check-box')));
  check('and a ticked row says so',
    page.rows()[0].querySelector('.trp-check-box').getAttribute('aria-pressed') === 'true' &&
    page.rows()[1].querySelector('.trp-check-box').getAttribute('aria-pressed') === 'false');
}

console.log('\nWeek 1 joins the list once it opens');
{
  const WEEK1 = [
    { id: 10, kind: 'link', title: 'Set your 90-day goal with your AI', body: 'No installs.', url: 'https://timerich.ai/portal/prompts.html' },
  ];
  const page = open({
    data: payload({ doneIds: PREP.map((i) => i.id), week1Open: true, week1Items: WEEK1, unlockedWeeks: [0, 1] }),
    now: '2026-10-27T12:00:00.000Z',
  });
  check('Week 1’s own item is counted with the rest',
    page.q('.trp-nextstep-count').textContent === '9 of 10 done',
    page.q('.trp-nextstep-count').textContent);
  check('and it is the step the card is on',
    page.stepTitle() === 'Set your 90-day goal with your AI', page.stepTitle());
  check('Start here comes first, Week 1 after it',
    page.stepTag() === 'Your next step · 10 of 10', page.stepTag());
}

console.log('\nNothing on the page is drawn twice');
{
  const page = open();
  const doc = page.doc;

  // The cards that used to double up with the new ones.
  check('the old Your progress card is gone',
    doc.querySelector('[data-portal-progress]') === null &&
    doc.querySelector('.trp-progress') === null);
  check('and the script that drew it is no longer loaded here',
    !HTML.includes('portal-progress.js'));
  check('the long week card is gone', doc.querySelector('[data-dash-start]') === null);
  check('and the Resume curriculum link with it',
    !/Resume curriculum/.test(doc.body.textContent),
    (doc.body.textContent.match(/.{0,30}Resume curriculum.{0,30}/) || [])[0]);

  // One of each block, counted on the page as rendered.
  for (const [what, sel] of [
    ['next step card', '.trp-nextstep'],
    ['next live session tile', '.trp-tile.trp-next'],
    ['partner tile', '.trp-ptile'],
    ['Start here list', '.trp-dlist'],
    ['Set up once card', '[data-portal-setup]'],
    ['Connect your Notion card', '.trp-connect'],
    ['Need a hand card', '.trp-aside'],
    ['countdown pill', '[data-dash-countdown]'],
  ]) {
    check('exactly one ' + what, doc.querySelectorAll(sel).length === 1,
      doc.querySelectorAll(sel).length);
  }

  // One progress bar per thing measured: materials on the next step card,
  // sessions on the tile. Two bars, two different numbers, no third.
  const bars = page.all('main .trp-progress-track');
  check('two bars, one for the steps and one for the sessions',
    bars.length === 2, bars.length);
  check('and they measure different things',
    bars[0].getAttribute('aria-valuemax') === '9' &&
    bars[1].getAttribute('aria-valuemax') === '10',
    bars.map((b) => b.getAttribute('aria-valuemax')));

  // The greeting appears once, not once per block.
  check('one h1 on the page', doc.querySelectorAll('main h1').length === 1);
  check('and one Curriculum link per purpose, not four',
    page.all('main a[href="curriculum.html"]').length === 2,
    page.all('main a[href="curriculum.html"]').map((a) => a.textContent.trim()));
}

console.log('\nThe bands are in the order the brief sets');
{
  const doc = open().doc;
  const order = ['.trp-dash-bar', '[data-dash-step]', '.trp-dash-tiles', '.trp-dash-cols']
    .map((sel) => [...doc.querySelectorAll('.trp-dash > *')].indexOf(doc.querySelector(sel)));
  check('welcome bar, next step, tiles, then the two columns',
    order.join(',') === '0,1,2,3', order);

  // Everything stacks on a phone by being one column to begin with; the
  // grid only splits above a breakpoint, so the source order is the order.
  const css = read('portal/portal-tailwind-src.css');
  check('the page is one column until 1024px',
    /\.trp-dash-cols \{ display: grid; gap: 20px; align-items: start; \}/.test(css) &&
    /@media \(min-width: 1024px\) \{\s*\.trp-dash-cols \{/.test(css));
  check('and the tiles are one column until 900px',
    /\.trp-dash-tiles \{ display: grid; gap: 20px; \}/.test(css) &&
    /@media \(min-width: 900px\) \{\s*\.trp-dash-tiles \{ grid-template-columns: repeat\(3/.test(css));
  check('the built stylesheet carries the layout, so the source was rebuilt',
    read('portal/portal.css').includes('.trp-nextstep') &&
    read('portal/portal.css').includes('.trp-dstep'));
}

console.log('\nThe copy');
{
  const doc = open().doc;
  const main = doc.querySelector('main').textContent;
  check('no long dashes anywhere on the page',
    !/[–—]/.test(main), (main.match(/.{0,30}[–—].{0,30}/) || [])[0]);
  check('and none in the markup either',
    !/[–—]/.test(HTML), (HTML.match(/.{0,40}[–—].{0,40}/) || [])[0]);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
