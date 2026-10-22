// The dashboard.
//
// The page is one question answered: what do I do next. The redesign answers
// it with the Set up list itself -- every Start here item in the Curriculum's
// order, the first unticked one tagged Next -- rather than with a card that
// quoted one step out of it. The bar under the greeting says how many are
// done, the band under the list says what happens when they all are, and the
// next call, the one-time setup and the partner offers sit below, because
// they are not the thing to do next.
//
// What this suite pins is the behaviour that is easy to break by hand: the
// tag is on the FIRST unticked step and moves when that step is ticked, a
// tick goes through the same TRPortal.setProgress every other tick on the
// site uses, Open does not tick anything, and the countdown says the right
// thing on each side of kickoff. The Join rule the page shares with Live
// Sessions has its own suite (portal-join.test.mjs), which compares the two
// pages on one clock; what is checked here is that this card really is on it.
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const LIVE = read('portal/portal-live.js');
const HTML = read('portal/dashboard.html');
const RESOURCES = read('portal/resources.html');
const SRC = read('portal/portal-tailwind-src.css');
const BUILT = read('portal/portal.css');

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

// Nine steps. The list shows all of them now: it is the page, not a preview
// of one, so there is no cap and no "+ N more" line to count.
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
   drives it. saved[] records every write a tick makes, so the test can prove
   it goes through the same TRPortal.setProgress every other tick on the site
   uses -- which is the call that reaches /portal-progress. */
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
  const text = (sel) => { const n = doc.querySelector(sel); return n ? n.textContent : null; };
  return {
    dom, w, doc, saved, text,
    q: (sel) => doc.querySelector(sel),
    all: (sel) => [...doc.querySelectorAll(sel)],
    rows: () => [...doc.querySelectorAll('.trp-dstep')],
    rowNames: () => [...doc.querySelectorAll('.trp-dstep-name')].map((n) => n.textContent),
    // The row carrying the Next tag, and its name.
    next: () => doc.querySelector('.trp-dstep.is-next'),
    nextName: () => {
      const r = doc.querySelector('.trp-dstep.is-next');
      return r ? r.querySelector('.trp-dstep-name').textContent : null;
    },
    meter: () => text('.trp-dash-meter-label'),
    row: (name) => [...doc.querySelectorAll('.trp-dstep')]
      .find((r) => r.querySelector('.trp-dstep-name').textContent === name),
  };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

console.log('\nThe Set up list is the page');
{
  const page = open();
  check('the list is shown, with every Start here step in it',
    page.q('[data-dash-list]').hidden === false && page.rows().length === 9,
    page.rows().length);
  check('in the order the Curriculum shows them',
    page.rowNames().join('|') === PREP.map((i) => i.title).join('|'), page.rowNames());
  check('nothing is dropped, so there is no "+ N more" line to go stale',
    !/\+ \d+ more/.test(page.q('main').textContent));
  check('the list is Step 1, to be done before kickoff',
    page.text('.trp-dash-stepn') === 'Step 1' &&
    /Before kickoff/.test(page.text('.trp-dash-stepmeta')));
  check('every row can be ticked', page.rows().every((r) => r.querySelector('.trp-check-box')));
  check('and a row carries its body under its name',
    page.row('Turn it on').querySelector('.trp-dstep-text').textContent === 'Hold fn on Mac.',
    page.row('Turn it on').querySelector('.trp-dstep-text').textContent);
  check('a row with no body grows no empty line',
    open({ data: { ...payload(), weeks: [{ id: 0, unlocked: true, items: [{ id: 1, title: 'Bare' }] }] } })
      .rows()[0].querySelector('.trp-dstep-text') === null);
}

console.log('\nThe first unticked step is the one tagged Next');
{
  const page = open();
  const tagged = page.rows().filter((r) => r.querySelector('.trp-dstep-tag'));
  check('exactly one row is tagged', tagged.length === 1, tagged.length);
  check('the tag reads Next', tagged[0].querySelector('.trp-dstep-tag').textContent === 'Next');
  check('and with nothing ticked it is the first row',
    page.nextName() === 'Welcome to the Superhuman Accelerator', page.nextName());

  // The first two are ticked, so the tag has to be on the third.
  const done = open({ data: payload({ doneIds: [4, 5] }) });
  check('a ticked step is skipped, not tagged',
    done.nextName() === 'Install Wispr Flow', done.nextName());
  check('exactly one row is still tagged',
    done.rows().filter((r) => r.querySelector('.trp-dstep-tag')).length === 1);
  check('a ticked row says so to a screen reader, and is marked done',
    done.row('Welcome to the Superhuman Accelerator').classList.contains('is-done') &&
    done.row('Welcome to the Superhuman Accelerator')
      .querySelector('.trp-check-box').getAttribute('aria-pressed') === 'true' &&
    done.row('Install Wispr Flow')
      .querySelector('.trp-check-box').getAttribute('aria-pressed') === 'false');

  // A gap in the middle: the tag follows the first one still open, not the
  // last one ticked.
  const gap = open({ data: payload({ doneIds: [4, 30, 40] }) });
  check('with a gap in the middle the tag is on the first one still open',
    gap.nextName() === 'Make your copy of the Business COMPASS', gap.nextName());

  const all = open({ data: payload({ doneIds: PREP.map((i) => i.id) }) });
  check('with everything ticked no row is tagged',
    all.rows().filter((r) => r.querySelector('.trp-dstep-tag')).length === 0);
}

console.log('\nThe bar under the greeting');
{
  const page = open({ data: payload({ doneIds: [4, 5] }) });
  check('it counts the whole list, not what is left',
    page.meter() === '2 of 9 set-up steps done', page.meter());
  check('and says the same thing to a screen reader',
    page.q('.trp-dash-meter .trp-progress-track').getAttribute('aria-valuenow') === '2' &&
    page.q('.trp-dash-meter .trp-progress-track').getAttribute('aria-valuemax') === '9' &&
    /2 of 9 done/.test(page.q('.trp-dash-meter .trp-progress-track').getAttribute('aria-label')),
    page.q('.trp-dash-meter .trp-progress-track').getAttribute('aria-label'));
  check('the fill is the share that is done, not a guess',
    page.q('.trp-dash-meter .trp-progress-fill').style.width === '22%',
    page.q('.trp-dash-meter .trp-progress-fill').style.width);

  const none = open({ data: { ...payload(), weeks: [] } });
  check('with no steps at all the bar is hidden rather than reading 0 of 0',
    none.q('[data-dash-meter]').hidden === true);
  check('and the whole Step 1 section goes with it',
    none.q('[data-dash-setup]').hidden === true);
}

console.log('\nTicking a row saves it and moves the count, without a reload');
{
  const page = open();
  const card = page.q('[data-dash-list]');
  check('it starts with the tag on the first step and nothing done',
    page.nextName() === 'Welcome to the Superhuman Accelerator' &&
    page.meter() === '0 of 9 set-up steps done', page.meter());

  page.next().querySelector('.trp-check-box').click();
  await settle();

  check('the write went through the usual TRPortal.setProgress',
    page.saved.length === 1 && page.saved[0].id === 4 &&
    page.saved[0].kind === 'item' && page.saved[0].value === true, page.saved);
  check('the count went up', page.meter() === '1 of 9 set-up steps done', page.meter());
  check('and the tag moved to the next unticked step',
    page.nextName() === 'Make your copy of the Business COMPASS', page.nextName());
  check('the page was not reloaded: the same card element is still there',
    card.isConnected === true);
  check('and the list did not double up', page.rows().length === 9, page.rows().length);

  // And again, to prove it is not a one-off.
  page.next().querySelector('.trp-check-box').click();
  await settle();
  check('a second tick advances it again',
    page.nextName() === 'Install Wispr Flow' &&
    page.meter() === '2 of 9 set-up steps done', page.nextName());

  // A row further down, not the tagged one.
  page.row('Say it: Who I serve').querySelector('.trp-check-box').click();
  await settle();
  check('a row further down can be ticked on its own',
    page.meter() === '3 of 9 set-up steps done' &&
    page.nextName() === 'Install Wispr Flow', page.meter());

  // Untick, which is the same route back.
  page.row('Welcome to the Superhuman Accelerator').querySelector('.trp-check-box').click();
  await settle();
  check('unticking saves the undo and hands the tag back',
    page.saved[page.saved.length - 1].value === false &&
    page.meter() === '2 of 9 set-up steps done' &&
    page.nextName() === 'Welcome to the Superhuman Accelerator', page.meter());
}

console.log('\nOpen is a way into the step, not a tick');
{
  const page = open();
  const row = page.row('Make your copy of the Business COMPASS');
  const link = row.querySelector('.trp-dstep-open');
  check('a step with a url gets an Open link',
    Boolean(link) && link.textContent === 'Open' &&
    link.getAttribute('href') === 'https://docs.google.com/document/d/x/copy',
    link && link.getAttribute('href'));
  check('it opens in a new tab, safely',
    link.getAttribute('target') === '_blank' &&
    link.getAttribute('rel') === 'noopener noreferrer');
  check('and it names the step it opens, so it is not nine links called Open',
    link.getAttribute('aria-label') === 'Open Make your copy of the Business COMPASS',
    link.getAttribute('aria-label'));

  link.click();
  await settle();
  check('clicking it writes nothing', page.saved.length === 0, page.saved);
  check('the step is still open, and still the one to do',
    row.classList.contains('is-done') === false &&
    row.querySelector('.trp-check-box').getAttribute('aria-pressed') === 'false' &&
    page.meter() === '0 of 9 set-up steps done', page.meter());

  check('a step with no url gets no Open link',
    page.row('Turn it on').querySelector('.trp-dstep-open') === null);
  check('but it still has its tick, or the list could never move on',
    page.row('Turn it on').querySelector('.trp-check-box') !== null);
}

console.log('\nThe band under the list');
{
  const band = (p) => [p.text('[data-dash-ready-title]'), p.text('[data-dash-ready-line]')];

  const part = open({ data: payload({ doneIds: [4, 5] }) });
  check('with steps left it asks, and points at Week 1',
    band(part).join(' | ') === 'All set up? | Week 1 opens on kickoff day. Preview it in the curriculum.',
    band(part));

  // One step short is still short.
  const nearly = open({ data: payload({ doneIds: PREP.slice(0, 8).map((i) => i.id) }) });
  check('one step short of the end it still asks',
    band(nearly)[0] === 'All set up?', band(nearly));

  const all = open({ data: payload({ doneIds: PREP.map((i) => i.id) }) });
  check('and only when every step is done does it say so, in the words from the brief',
    band(all).join(' | ') === 'You’re ready for kickoff. | Everything on your Start here list is done.',
    band(all));
  check('it offers the curriculum either way, rather than a dead end',
    all.q('.trp-dash-cta').getAttribute('href') === 'curriculum.html' &&
    /Open the curriculum/.test(all.q('.trp-dash-cta').textContent));

  // A tick is all it takes: the band is redrawn from the state the tick wrote.
  const live = open({ data: payload({ doneIds: PREP.slice(0, 8).map((i) => i.id) }) });
  live.next().querySelector('.trp-check-box').click();
  await settle();
  check('ticking the last step turns the band over there and then',
    live.text('[data-dash-ready-title]') === 'You’re ready for kickoff.',
    live.text('[data-dash-ready-title]'));
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
    page.meter() === '9 of 10 set-up steps done', page.meter());
  check('Start here comes first, Week 1 after it',
    page.rowNames()[9] === 'Set your 90-day goal with your AI', page.rowNames()[9]);
  check('and it is the step tagged Next',
    page.nextName() === 'Set your 90-day goal with your AI', page.nextName());
  check('so the band is not saying the list is finished',
    page.text('[data-dash-ready-title]') === 'All set up?');

  // A week that has not opened contributes nothing.
  const shut = open({
    data: payload({ doneIds: PREP.map((i) => i.id), week1Open: false, week1Items: WEEK1 }),
  });
  check('a week that has not opened keeps its items out of the list',
    shut.rows().length === 9 && shut.meter() === '9 of 9 set-up steps done', shut.meter());
}

console.log('\nThe countdown pill');
{
  const pill = (now, data = payload()) => {
    const p = open({ data, now });
    const el = p.q('[data-dash-countdown]');
    return el.hidden ? null : el.textContent;
  };

  check('nine days before: the cohort, the kickoff, the days to go',
    pill('2026-10-17T12:00:00.000Z') ===
      'Superhuman Accelerator · Kickoff Mon 26 Oct, 12pm ET · 9 days to go',
    pill('2026-10-17T12:00:00.000Z'));
  check('the day before: one day, in the singular',
    /· 1 day to go$/.test(pill('2026-10-25T12:00:00.000Z')),
    pill('2026-10-25T12:00:00.000Z'));

  // Eastern days, not the member's. 03:00 UTC on the 26th is still the 25th
  // in New York, so it is a day to go, not kickoff day.
  check('counted in Eastern days, so a member in Sydney sees what one in LA sees',
    /· 1 day to go$/.test(pill('2026-10-26T03:00:00.000Z')),
    pill('2026-10-26T03:00:00.000Z'));
  check('kickoff morning, before the call: Kickoff today',
    pill('2026-10-26T13:00:00.000Z') === 'Superhuman Accelerator · Kickoff today',
    pill('2026-10-26T13:00:00.000Z'));
  check('kickoff evening, after the call: still Kickoff today',
    pill('2026-10-26T23:00:00.000Z') === 'Superhuman Accelerator · Kickoff today',
    pill('2026-10-26T23:00:00.000Z'));

  const open1 = payload({ week1Open: true, unlockedWeeks: [0, 1] });
  check('after kickoff it stops counting and says where the cohort is',
    pill('2026-10-28T12:00:00.000Z', open1) === 'Superhuman Accelerator · Week 1 of 4',
    pill('2026-10-28T12:00:00.000Z', open1));
  const open3 = payload({ week1Open: true, unlockedWeeks: [0, 1, 2, 3] });
  check('and it follows the weeks that have opened',
    pill('2026-11-10T12:00:00.000Z', open3) === 'Superhuman Accelerator · Week 3 of 4',
    pill('2026-11-10T12:00:00.000Z', open3));
  check('never Week 0 of 4, even the day after kickoff with nothing opened',
    pill('2026-10-27T12:00:00.000Z') === 'Superhuman Accelerator · Week 1 of 4',
    pill('2026-10-27T12:00:00.000Z'));

  // No schedule, nothing to count from.
  const bare = { ...payload(), sessions: [] };
  check('with no sessions at all the pill is hidden rather than blank',
    pill('2026-10-17T12:00:00.000Z', bare) === null);
}

console.log('\nThe next live session card is on the shared Join rule');
{
  // The rule itself is proved in portal-join.test.mjs, which puts this page
  // and Live Sessions on one clock. What is checked here is that this card
  // is on it, which is the drift that once put a live link on one page and
  // a dead one on the other.
  const at = (now) => open({ now });

  const far = at('2026-10-17T12:00:00.000Z');
  check('it names the next session, with its date and time in Eastern',
    far.text('[data-dash-next] .trp-next-title') === 'Open Business Surgery' &&
    /Mon 26 Oct/i.test(far.text('[data-dash-next] .trp-next-when')),
    far.text('[data-dash-next] .trp-next-when'));
  check('nine days out the Join button is there but shut, and says when it opens',
    far.q('[data-dash-next] button').disabled === true &&
    far.q('[data-dash-next] a') === null &&
    far.text('[data-dash-next] .trp-join-note') === 'Opens 30 minutes before the start.',
    far.text('[data-dash-next] .trp-join-note'));

  // 11:29 ET is a minute outside the window; 11:30 is inside it.
  const minuteBefore = at('2026-10-26T15:29:00.000Z');
  check('a minute before the window opens it is still shut',
    minuteBefore.q('[data-dash-next] button').disabled === true &&
    minuteBefore.q('[data-dash-next] a') === null);

  const openWindow = at('2026-10-26T15:30:00.000Z');
  check('exactly thirty minutes before the start it opens',
    openWindow.q('[data-dash-next] a').getAttribute('href') === 'https://zoom.us/j/1' &&
    /Join via Zoom/.test(openWindow.text('[data-dash-next] a')),
    openWindow.text('[data-dash-next] a'));
  check('and the line explaining the wait goes away with it',
    openWindow.q('[data-dash-next] .trp-join-note') === null);
  check('it stays open while the call is running',
    at('2026-10-26T17:00:00.000Z').q('[data-dash-next] a') !== null);

  // 75 minutes after a 12pm ET start is 13:15 ET / 17:15 UTC.
  const ended = at('2026-10-26T17:15:00.000Z');
  check('when the call ends the link shuts and the card moves to the next one',
    ended.text('[data-dash-next] .trp-next-title') === 'Training Your Agent' &&
    ended.q('[data-dash-next] button').disabled === true,
    ended.text('[data-dash-next] .trp-next-title'));

  // Past the last session there is no next one to show.
  const after = at('2026-12-01T12:00:00.000Z');
  check('past the last session the card hides rather than showing an empty one',
    after.q('[data-dash-next]').hidden === true);
  const withRec = {
    ...payload(),
    sessions: SESSIONS.map((s, i) => (i === 9 ? { ...s, recording_url: 'https://vimeo.com/1' } : s)),
  };
  const rec = open({ data: withRec, now: '2026-12-01T12:00:00.000Z' });
  check('unless there is a recording to offer instead',
    rec.text('[data-dash-next] .trp-tag') === 'Latest recording' &&
    rec.q('[data-dash-next] a').getAttribute('href') === 'https://vimeo.com/1',
    rec.text('[data-dash-next] .trp-tag'));
}

console.log('\nThe partner offers');
{
  const page = open();
  const card = page.q('.trp-dash-partners');
  const names = [...card.querySelectorAll('.trp-ptile-name')].map((n) => n.textContent);
  check('the card lists the three partners',
    names.join('|') === 'Stanley|Wispr Flow|LaunchLemonade', names);
  check('and sends people to Resources to claim them',
    /Claim in Resources/.test(card.querySelector('.trp-tile-go').textContent) &&
    card.querySelector('.trp-tile-go').getAttribute('href') === 'resources.html');

  // These used to be Resources' lines, checked word for word against that
  // page: two files, one set of words.
  //
  // They have different jobs now. The Resources cards carry numbered steps
  // for claiming each offer, so their line shrank to a strapline sitting
  // above those steps -- "Your AI head of content. The code goes in at
  // checkout." On the dashboard there are no steps and no room for any, so
  // this card still has to say what the offer actually is in one sentence.
  //
  // So the two are pinned separately rather than against each other. The
  // drift this was written to catch is still caught; it is just caught in
  // two places. What must still agree is the offer itself, which is the
  // last block below.
  const lines = [...card.querySelectorAll('.trp-ptile-line')].map((n) => n.textContent);
  check('the card says what each offer is, in one sentence',
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
    check('"' + term + '" is on both the dashboard card and Resources',
      lines.join(' ').includes(term) === resourcesText.includes(term) &&
      resourcesText.includes(term),
      { dashboard: lines.join(' ').includes(term), resources: resourcesText.includes(term) });
  }

  // The redesign dropped these four rules and left the markup using them, so
  // a partner's name ran straight into its line: "Stanley 6 months of
  // Stanley free...". A name on its own line is a style here, not a tag,
  // which is why it is pinned rather than left to the eye.
  check('a name is its own line, in the weight the card sets',
    /\.trp-ptile-list li \{ display: grid;/.test(SRC) &&
    /\.trp-ptile-name \{[^}]*font-weight: 600;/.test(SRC) &&
    /\.trp-ptile-name \{[^}]*font-size: 14px;/.test(SRC), 'portal-tailwind-src.css');
  check('the line under it is the muted ink, and the partners are spaced apart',
    /\.trp-ptile-line \{[^}]*color: var\(--trp-muted\);/.test(SRC) &&
    /\.trp-ptile-list \{[^}]*gap: 14px;/.test(SRC));
  check('the way through to Resources is a text link, like a step’s Open',
    /\.trp-tile-go \{[^}]*text-decoration: underline;/.test(SRC) &&
    /\.trp-tile-go \{[^}]*color: var\(--trp-ink\);/.test(SRC));
  check('and the built stylesheet carries all four, so the source was rebuilt',
    ['.trp-ptile-list', '.trp-ptile-name', '.trp-ptile-line', '.trp-tile-go']
      .every((c) => BUILT.includes(c)),
    ['.trp-ptile-list', '.trp-ptile-name', '.trp-ptile-line', '.trp-tile-go']
      .filter((c) => !BUILT.includes(c)));
}

console.log('\nThe Next tag is brand green, because purple means "not yet"');
{
  // Purple is reserved on every portal page: the Soon pill beside Members
  // and the Coming soon pill on a card. The Next tag says the opposite of
  // "not yet", so it takes the open week card's colours instead.
  const tag = (SRC.match(/\.trp-dstep-tag \{[^}]*\}/) || [])[0] || '';
  check('the tag is filled with the brand green',
    /background: rgb\(var\(--c-green\)\);/.test(tag), tag);
  check('with cream type on it', /color: #FFFDFB;/.test(tag), tag);
  check('and no purple anywhere in the rule', !/plum|7B6CF6/i.test(tag), tag);
  check('the dark theme inverts it the way it inverts every other olive fill',
    /:root\[data-theme='dark'\] \.trp-dstep-tag,/.test(SRC) &&
    /:root\[data-theme='system'\] \.trp-dstep-tag,/.test(SRC));
  check('so neither dark theme reaches for the Soon pill’s purple',
    !/\[data-theme='(dark|system)'\] \.trp-dstep-tag \{/.test(SRC),
    (SRC.match(/\[data-theme='(dark|system)'\] \.trp-dstep-tag \{[^}]*\}/) || [])[0]);
  check('and the built stylesheet has no #7B6CF6 left in it', !/7b6cf6/i.test(BUILT));
  // The reserved colour is still reserved, not deleted.
  check('purple is still there for the things that do mean "not yet"',
    /--c-plum:/.test(SRC) && /--c-plumbg:/.test(SRC));
}

console.log('\nSet up once asks for one thing, and Step 1 has the other');
{
  const page = open();
  const main = page.q('main').textContent;
  // "Duplicate your Superhuman OS" sat on this card saying the same thing as
  // Step 1's own "Duplicate the Superhuman Workbook" -- two names for one
  // task, and the only one marked Coming soon was the duplicate.
  check('the card no longer asks for the Superhuman OS a second time',
    !/Superhuman OS/.test(main), (main.match(/.{0,40}Superhuman OS.{0,40}/) || [])[0]);
  check('and nothing on the page reads "Coming soon"',
    !/Coming soon/.test(main), (main.match(/.{0,40}Coming soon.{0,40}/) || [])[0]);
  check('the calendar row is the one that stayed',
    /Add every session to your calendar/.test(main));
  check('its placeholder counts the one row it draws',
    /0 of 1 complete/.test(main), (main.match(/\d+ of \d+ complete/) || [])[0]);

  // The renderer counts off its own list, so the heading cannot drift from
  // the rows again.
  const SETUP = read('portal/portal-setup.js');
  check('the count is read off the step list, not written out by hand',
    /' of ' \+ STEPS\.length \+ ' complete'/.test(SETUP) && !/of 2 complete/.test(SETUP));
  check('and one step is all the list holds',
    (SETUP.match(/\{key: '\w+'/g) || []).length === 1,
    (SETUP.match(/\{key: '\w+'/g) || []));
}

console.log('\nNothing on the page is drawn twice');
{
  const page = open();
  const doc = page.doc;

  // The cards the redesign replaced, and which would double up with the new
  // ones if any came back.
  check('the old Your progress card is gone',
    doc.querySelector('[data-portal-progress]') === null &&
    doc.querySelector('.trp-progress') === null);
  check('and the script that drew it is no longer loaded here',
    !HTML.includes('portal-progress.js'));
  check('the old next step card is gone, the list answers that question now',
    doc.querySelector('[data-dash-step]') === null &&
    doc.querySelector('.trp-nextstep') === null);
  check('so are the three tiles and the two columns',
    doc.querySelector('.trp-dash-tiles') === null &&
    doc.querySelector('.trp-dash-cols') === null &&
    doc.querySelector('.trp-tile') === null);
  check('and the preview list with its "+ N more" line',
    doc.querySelector('.trp-dlist') === null &&
    doc.querySelector('.trp-dlist-more') === null);
  check('the long week card is gone', doc.querySelector('[data-dash-start]') === null);
  check('and the Resume curriculum link with it',
    !/Resume curriculum/.test(doc.body.textContent),
    (doc.body.textContent.match(/.{0,30}Resume curriculum.{0,30}/) || [])[0]);

  // One of each block, counted on the page as rendered.
  for (const [what, sel] of [
    ['countdown pill', '[data-dash-countdown]'],
    ['set-up bar', '[data-dash-meter]'],
    ['Set up list', '[data-dash-list]'],
    ['Set up list, as a card', '.trp-dash-card'],
    ['next live session card', '[data-dash-next]'],
    ['partner card', '.trp-dash-partners'],
    ['Set up once card', '[data-portal-setup]'],
    ['Connect your Notion card', '.trp-connect'],
    ['band under the list', '.trp-dash-ready'],
    ['way into the curriculum', '.trp-dash-cta'],
  ]) {
    check('exactly one ' + what, doc.querySelectorAll(sel).length === 1,
      doc.querySelectorAll(sel).length);
  }

  // One progress bar, for the one thing this page measures. The sessions
  // count lived on a tile that is gone; it is on Live Sessions now.
  const bars = page.all('main .trp-progress-track');
  check('one bar, for the set-up steps', bars.length === 1, bars.length);
  check('and it measures those nine, nothing else',
    bars[0].getAttribute('aria-valuemax') === '9',
    bars[0].getAttribute('aria-valuemax'));

  // The greeting appears once, not once per block.
  check('one h1 on the page', doc.querySelectorAll('main h1').length === 1);
  check('and one Curriculum link, not four',
    page.all('main a[href="curriculum.html"]').length === 1,
    page.all('main a[href="curriculum.html"]').map((a) => a.textContent.trim()));
}

console.log('\nThe bands are in the order the brief sets');
{
  const doc = open().doc;
  const order = ['.trp-dash-hero', '[data-dash-setup]', '.trp-connect', '.trp-dash-ready', '.trp-dash-more']
    .map((sel) => [...doc.querySelectorAll('.trp-dash > *')].indexOf(doc.querySelector(sel)));
  check('greeting, Step 1, Step 2, the band, then everything under it',
    order.join(',') === '0,1,2,3,4', order);

  // Under the band: the call, the one-time setup, the partner offers, in
  // that order, because that is how urgent they are.
  const more = [...doc.querySelectorAll('.trp-dash-more > *')];
  check('the call comes first under the band, then setup, then the partners',
    more.map((n) => n.matches('[data-dash-next]') ? 'next'
      : n.matches('[data-portal-setup]') ? 'setup'
      : n.matches('.trp-dash-partners') ? 'partners' : '?').join(',') === 'next,setup,partners',
    more.map((n) => n.className));

  // Everything stacks on a phone by being one column to begin with.
  check('the list and everything under it is one column at any width',
    /\.trp-dash-more \{ display: flex; flex-direction: column; gap: 20px; \}/.test(SRC) &&
    !/\.trp-dash-more[^}]*grid-template-columns/.test(SRC));
  check('a step row wraps rather than scrolling sideways',
    /\.trp-dstep-text \{[^}]*overflow-wrap: anywhere;/.test(SRC) &&
    /\.trp-dstep-copy \{[^}]*min-width: 0;/.test(SRC));

  // <main> is a flex item, so its default min-width is its content's
  // minimum rather than zero. The set-up bar carries a 320px progress
  // track, so without min-w-0 the page could not lay out narrower than
  // about 350px and a 320px screen scrolled sideways by 33px. Measured in
  // headless Chrome: 320, 375, 390, 768, 1024 and 1440 all report
  // scrollWidth === clientWidth, in both themes.
  check('main can shrink below its widest child, so a 320px screen fits',
    doc.querySelector('main').classList.contains('min-w-0') &&
    BUILT.includes('min-width:0'),
    doc.querySelector('main').className);
  check('the built stylesheet carries the layout, so the source was rebuilt',
    BUILT.includes('.trp-dstep') && BUILT.includes('.trp-dash-ready'));
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
