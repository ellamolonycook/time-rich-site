// Ella's 25 Oct batch: the Resources page and the Curriculum.
//
// Resources is now a place in the top menu rather than a card at the foot of
// the course, so it carries a link back to the course and a link card
// straight to Week 1's growth prompts. The three Superhuman agents are cards
// beside the agent comparison that names them.
//
// The agent comparison is one file, portal-agents.js, drawn on both pages
// from the same rows, so Ella changes it once.
//
// On the Curriculum: the Pep Talk opens for everyone, the Join button is
// gone (the Zoom link lives in the calendar invite), the week's calls sit at
// the top of the panel, the weeks still to come are one line each under
// "What's next", a row ticks when you click it rather than only its box, and
// Week 1's own "Run your Time Rich Audit" row carries the audit table in
// its detail, under the prompt that row already holds, and the block under
// the week carries the agent comparison, the ten growth prompts, next steps
// and the cohort's questions. A row body can also open a copy box of its
// own with a "= Copy: " line, which is how the #introductions format is
// written in Supabase rather than in this page.
//
// The Curriculum is driven the way portal-access.js drives it: the real
// portal-live.js and the real club/portal-access.js, then the payload handed
// over as a trportal:data event.
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const LIVE = read('club/portal-live.js');
const ACCESS = read('club/portal-access.js');
const HTML = read('club/curriculum.html');
const RES = read('club/resources.html');
const AGENTS = read('club/portal-agents.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

/* =========================================================================
   The Resources page
   ========================================================================= */

const resDoc = new JSDOM(RES).window.document;

console.log('\nResources: the heading on its own, and a way back to the course');
{
  const h1 = resDoc.querySelector('h1');
  check('the heading is Resources', h1 && h1.textContent.replace(/\./g, '').trim() === 'Resources',
    h1 && h1.textContent);
  check('the line under it is gone',
    !RES.includes('Your partner offers, agent guide and answers'));
  check('and so is any "every prompt and every skill" wording',
    !/every prompt and every skill/i.test(RES));

  const back = resDoc.querySelector('.trp-res-back');
  check('a Back to the course link is on the page',
    back !== null && back.textContent.trim() === 'Back to the course', back && back.textContent.trim());
  check('it goes to the curriculum', back && back.getAttribute('href') === 'curriculum');
  check('and it is the first thing in the header',
    back && back.parentElement.tagName === 'HEADER' &&
    back.parentElement.firstElementChild === back,
    back && back.parentElement.tagName);
}

console.log('\nResources: a link card to the ten growth prompts');
{
  const card = resDoc.querySelector('.trp-reslink');
  check('the card is there', card !== null);
  check('it says what it is',
    card && card.querySelector('.trp-reslink-title').textContent.trim() === '10 growth prompts',
    card && card.querySelector('.trp-reslink-title').textContent);
  // The curriculum reads this hash, picks Week 1 and scrolls to the section.
  check('and it goes to the growth prompts in the curriculum',
    card && card.getAttribute('href') === 'curriculum#growth-prompts',
    card && card.getAttribute('href'));
}

console.log('\nResources: the three Superhuman agents, as cards');
{
  // Beside the comparison that names Instinct, in a card of its own.
  const section = resDoc.querySelector('section[aria-labelledby="agents-join-heading"]');
  check('they have their own section', section !== null);
  check('it sits directly after the comparison',
    section && section.previousElementSibling &&
    section.previousElementSibling.hasAttribute('data-agents-block'),
    section && section.previousElementSibling &&
      section.previousElementSibling.className);

  const cards = section ? [...section.querySelectorAll('.trp-partner')] : [];
  check('three of them', cards.length === 3, cards.length);
  check('and the same card as the partner offers above',
    cards.every((c) => c.classList.contains('glass-card')));

  const WANT = [
    ['Instinct', 'Chief of Staff', 'Inbox, calendar, call prep, travel, admin.', 'Join Instinct',
      'https://app.instinct.com/invite?t=uwtiwya74qy2r7ntq3mdmzrrxu&preview=imessage'],
    ['Stanley', 'Head of Content', 'Posts, newsletters, repurposing, publishing.', 'Join Stanley',
      'https://x.getstanley.ai/r/mz4y9g'],
    ['Boardy', 'AI SuperConnector', 'Intros, meetings, booking, pre-call prep.', 'Join Boardy',
      'https://boardy.ai/links/zTblS'],
  ];
  WANT.forEach(([name, role, line, label, href], i) => {
    const card = cards[i];
    if (!card) { check(name + ': the card exists', false); return; }
    const title = card.querySelector('.trp-partner-title').textContent;
    check(name + ': named, with its job', title.includes(name) && title.includes(role), title);
    check(name + ': its one line', card.querySelector('.trp-partner-line').textContent.trim() === line,
      card.querySelector('.trp-partner-line').textContent.trim());
    const btn = card.querySelector('a.trp-partner-btn');
    check(name + ': the button says "' + label + '"', btn && btn.textContent.trim() === label,
      btn && btn.textContent.trim());
    check(name + ': and goes where Ella sent it', btn && btn.getAttribute('href') === href,
      btn && btn.getAttribute('href'));
    // Every one of these is a commercial relationship, and every one opens
    // out of the portal, which is the only reason a link leaves the page.
    check(name + ': opens in its own tab, marked sponsored',
      btn && btn.getAttribute('target') === '_blank' && /sponsored/.test(btn.getAttribute('rel')),
      btn && btn.getAttribute('rel'));
  });
}

console.log('\nResources: the FAQ points at the Curriculum, and Live Sessions is gone');
{
  /* Live Sessions was a second place to look for a recording, and the only
     page in the portal with no way in. Every call is on the Curriculum now,
     in its week, with the recording under it -- so the FAQ sends members
     there and the old page is a redirect. */
  const answers = [...resDoc.querySelectorAll('.trp-faq-answer')];
  const missed = answers.filter((p) => /Every session is recorded/.test(p.textContent))[0];
  check('the "what if I miss a session" answer is there', Boolean(missed));
  const link = missed && missed.querySelector('a[href]');
  check('and it sends them to the Curriculum',
    link && link.getAttribute('href') === '/club/curriculum' &&
    link.textContent.includes('Curriculum page'),
    link && link.getAttribute('href'));

  const where = answers.filter((p) => /A Watch recording button appears/.test(p.textContent))[0];
  check('and so does "where are the recordings"',
    where && where.querySelector('a[href]').getAttribute('href') === '/club/curriculum',
    where && where.querySelector('a[href]').getAttribute('href'));

  check('nothing on the page still says Live Sessions',
    !/Live Sessions/.test(RES), (RES.match(/.{0,40}Live Sessions.{0,20}/) || [])[0]);
  check('and nothing links to the old page',
    !/href="sessions"/.test(RES) && !/href="sessions"/.test(HTML));

  // The old address still lands somewhere, with the query and the hash.
  const sessions = read('club/sessions.html');
  check('/club/sessions redirects to the Curriculum',
    /window\.location\.replace\('\/club\/curriculum' \+/.test(sessions));
  check('keeping the query and the hash',
    sessions.includes('window.location.search + window.location.hash'));
  check('with a refresh for a browser with scripts off',
    /http-equiv="refresh" content="0; url=\/club\/curriculum"/.test(sessions));
  check('and it is kept out of the index', /name="robots" content="noindex"/.test(sessions));
}

/* =========================================================================
   The agent comparison: one file, both pages
   ========================================================================= */

/* The block is built at runtime, so the page has to be run to see it. */
function withAgents(html, url) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', virtualConsole: new VirtualConsole() });
  dom.window.eval(AGENTS);
  dom.window.TRAgents.mount();
  return dom.window;
}

const AGENT_ROWS = [
  ['Dots', 'OpenAI', 'https://chatgpt.com'],
  ['Muse', 'Meta', 'https://www.meta.ai'],
  ['Grok Bot', 'xAI', 'https://grok.com'],
  ['Instinct', 'Instinct', 'https://app.instinct.com/invite?t=uwtiwya74qy2r7ntq3mdmzrrxu&preview=imessage'],
  ['Town', 'Town', 'https://www.town.com'],
  // Hark's own site, checked on 26 Oct 2026.
  ['Hark', 'Hark Labs', 'https://hark.com/'],
];

console.log('\nThe agent comparison is built from one file, for both pages');
{
  check('neither page carries the table as markup',
    !RES.includes('Grok Bot') && !HTML.includes('Grok Bot'));
  check('both ask the shared file for it',
    RES.includes('data-agents-block') && HTML.includes('data-agents-block') &&
    RES.includes('portal-agents.js') && HTML.includes('portal-agents.js'));

  // The date label is gone: it ages in public and says nothing a member can
  // act on.
  check('no "checked" date on it anywhere',
    !/Checked \d+ \w+ 20\d\d/i.test(RES) && !/Checked \d+ \w+ 20\d\d/i.test(HTML) &&
    !/Checked \d+ \w+ 20\d\d/i.test(AGENTS),
    (RES.match(/Checked[^<]*/) || HTML.match(/Checked[^<]*/) || [])[0]);
  check('and no NEW flag either',
    !/trp-tag">New /i.test(RES) && !/trp-tag">New /i.test(HTML));

  const pages = {
    resources: withAgents(RES, 'https://timerich.ai/club/resources'),
    curriculum: withAgents(HTML, 'https://timerich.ai/club/curriculum'),
  };

  for (const [name, w] of Object.entries(pages)) {
    const block = w.document.querySelector('[data-agents-block]');
    check(name + ': the block is filled', block !== null && block.children.length > 0);

    const heading = block.querySelector('.trp-section-title');
    check(name + ': with the heading',
      heading && heading.textContent === 'Which personal AI agent should you start with?',
      heading && heading.textContent);
    check(name + ': the box is labelled by it',
      block.getAttribute('aria-labelledby') === heading.id,
      [block.getAttribute('aria-labelledby'), heading.id]);

    const rows = [...block.querySelectorAll('.trp-agents tbody tr')];
    check(name + ': six agents', rows.length === 6, rows.length);

    const got = rows.map((r) => [
      r.querySelector('.trp-agent-name').textContent,
      r.querySelectorAll('td')[0].textContent,
      r.querySelector('.trp-agent-link')
        ? r.querySelector('.trp-agent-link').getAttribute('href') : '',
    ]);
    check(name + ': the right six, in order, each linked where Ella sent it',
      JSON.stringify(got) === JSON.stringify(AGENT_ROWS), got);

    // Town goes in after Instinct, not at the end.
    const names = got.map((g) => g[0]);
    check(name + ': Town comes straight after Instinct',
      names.indexOf('Town') === names.indexOf('Instinct') + 1, names);

    const town = rows[4];
    check(name + ": Town's row is Ella's copy",
      [...town.querySelectorAll('td')].map((td) => td.textContent).join(' | ') ===
      'Town | Its own @town.com email, plus Gmail, Outlook, Slack, WhatsApp and a Mac app | ' +
      'A daily inbox triage and a weekly briefing | ' +
      'Paid plans use credits, so set a spend cap. Keep the approval queue on.',
      [...town.querySelectorAll('td')].map((td) => td.textContent));

    const links = [...block.querySelectorAll('.trp-agent-link')];
    check(name + ': six links, one per agent', links.length === 6, links.length);
    check(name + ': every one opens in a new tab, safely',
      links.every((a) => a.getAttribute('target') === '_blank' &&
        /noopener/.test(a.getAttribute('rel')) && a.href.startsWith('https://')),
      links.map((a) => [a.getAttribute('target'), a.getAttribute('rel')]));
    check(name + ': and each says so to a screen reader',
      links.every((a) => /opens in a new tab/.test(a.getAttribute('aria-label') || '')));
    check(name + ': Hark links to its own site',
      rows[5].querySelector('.trp-agent-link') !== null &&
      rows[5].querySelector('.trp-agent-link').getAttribute('href') === 'https://hark.com/');

    // The 900px card layout draws each cell's heading from its data-label.
    check(name + ': every cell carries its column name for the phone layout',
      rows.every((r) => [...r.querySelectorAll('td')].every((td) => td.hasAttribute('data-label'))));

    const rules = [...block.querySelectorAll('.trp-step-body')].map((n) => n.textContent);
    check(name + ': three rules come with it', rules.length === 3, rules.length);
    check(name + ': and they are the ones Ella rewrote',
      rules[0] === 'Connect your tools first. Give your agent your email, calendar and LinkedIn, so it works from what you already know, not a blank page.' &&
      rules[1] === 'Delegate a growth task first. Start with one task that brings in money every week, like follow-ups or a morning lead brief, and count how much you have to correct.' &&
      rules[2] === 'Keep approval on. Anything that sends a message, spends money or books something waits for your yes.',
      rules);
    // The lead of each one is the instruction, set apart from its reason.
    check(name + ': each one leads with the instruction, in bold',
      [...block.querySelectorAll('.trp-step-body b')].map((b) => b.textContent).join('|') ===
      'Connect your tools first.|Delegate a growth task first.|Keep approval on.',
      [...block.querySelectorAll('.trp-step-body b')].map((b) => b.textContent));
  }

  // The point of the shared file: the two are the same block.
  const strip = (w) => w.document.querySelector('[data-agents-block]').innerHTML
    .replace(/agents-heading-\d+/g, 'id');
  check('the two pages draw the same block, character for character',
    strip(pages.resources) === strip(pages.curriculum));

  // A bad edit must not become a javascript: link in a members' page.
  check('only https is allowed through', /u\.protocol === 'https:'/.test(AGENTS));
  check('and nothing is built from a string of markup', !/innerHTML/.test(AGENTS));
}

/* =========================================================================
   The Curriculum
   ========================================================================= */

const LETTER_BODY = [
  "You're not here just to learn AI. You're here for an outcome.",
  'The middle of the letter, which stays in the Pep Talk.',
  'How serious are you about becoming Time Rich?',
].join('\n\n');

const LETTER = { id: 10, kind: 'text', title: 'Welcome to the Superhuman Accelerator', body: LETTER_BODY, sort: 10 };
const STEP = { id: 110, kind: 'link', title: 'Join the Club Slack', body: 'Say hello.', url: 'https://join.slack.com/t/x/shared_invite/y', sort: 110 };

// Week 1's own rows: one that can be ticked, and one video that cannot.
const LESSON = { id: 201, kind: 'text', title: 'Diagnose your week', body: 'Watch, then do.', sort: 10 };
const LESSON_VIDEO = { id: 202, kind: 'video', title: 'Masterclass replay', url: 'https://vimeo.com/123456789', sort: 20 };

/* The row the audit table belongs to. Its body is what the 25 Oct
   migration leaves behind: a line of instructions to the member, then the
   marker, then Ella's prompt -- which has blank lines between its
   paragraphs, and has to stay in one box all the same. */
const AUDIT_PROMPT = [
  'Run a Time Rich Audit on my last week. Read my Business COMPASS first if it is in this project.',
  '',
  '1. List every task over 15 minutes with its hours.',
  '2. Mark a task $ only if it put me in front of someone who can pay me this month.',
  '',
  "Don't invent tasks, hours or offers.",
  '',
  'My last week:',
].join('\n');
const AUDIT = {
  id: 203, kind: 'text', title: 'Run your Time Rich Audit', sort: 40,
  body: 'Paste your 2-minute voice note of last week at the end of this prompt.\n\n'
      + '= Copy: Your audit prompt\n' + AUDIT_PROMPT,
};

/* A row whose body opens a copy box, then a drop-down after it. This is the
   shape of the #introductions row in Supabase, and the blank line before the
   "+ " is what closes the box. */
const INTRO_TEXT = [
  '1. Name, company, city. Where you\u2019re based.',
  '2. What your business does. The problem you solve, in one sentence.',
].join('\n');
const INTRO = {
  id: 204, kind: 'text', title: 'Say hello in #introductions', sort: 50,
  body: [
    'Introduce yourself in Slack in this format. Please keep it short and clear!',
    '',
    '= Copy: Your intro',
    INTRO_TEXT,
    '',
    '+ The channels, and where to ask',
    '#introductions',
    'Say hello.',
  ].join('\n'),
};

const SESSIONS = [
  { id: 1, week_id: 1, title: 'Monday masterclass', starts_at: '2026-10-26T16:00:00.000Z', join_url: 'https://zoom.us/j/1' },
  { id: 2, week_id: 1, title: 'Friday hot seat', starts_at: '2026-10-30T16:00:00.000Z', join_url: 'https://zoom.us/j/2' },
];

const OPENS = {
  2: '2026-11-02T04:00:00.000Z',
  3: '2026-11-09T04:00:00.000Z',
  4: '2026-11-16T04:00:00.000Z',
};

function payload(doneIds) {
  return {
    ok: true,
    member: { first_name: 'Ella', role: 'buyer', setup: { calendar: false, notion: false } },
    weeks: [0, 1, 2, 3, 4].map((id) => ({
      id,
      title: id === 0 ? 'Week 1: Start here' : 'Week ' + id + ': Pillar ' + id,
      unlocked: id === 0 || id === 1,
      release_at: id <= 1 ? '2026-10-26T04:00:00.000Z' : OPENS[id],
      items: id === 0 ? [LETTER, STEP] : (id === 1 ? [LESSON, LESSON_VIDEO, AUDIT, INTRO] : []),
    })),
    sessions: SESSIONS,
    progress: { items: doneIds || [], sessions: [] },
  };
}

/* Pins the clock, so nothing here turns on the day it runs. */
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

function open(doneIds, hash) {
  return openWith(payload(doneIds), hash);
}

function openWith(data, hash) {
  const dom = new JSDOM(HTML, {
    url: 'https://timerich.ai/club/curriculum' + (hash || ''),
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),   // the shell's own scripts are not under test here
    beforeParse(window) {
      window.tailwind = {};
      window.gtag = () => {};
      window.TR_PORTAL_CONFIG = { sessionUrl: 'https://worker.test/portal-session' };
      window.localStorage.setItem('tr_portal_session', JSON.stringify({ token: 'tok-ABCDE', expires_at: new Date(Date.now() + 30 * 864e5).toISOString() }));
      window.fetch = () => Promise.resolve(new globalThis.Response(JSON.stringify(data), { status: 200 }));
      freeze(window, '2026-10-27T12:00:00.000Z');
      window.eval(LIVE);     // the page's inline renderer needs TRLive at parse time
    },
  });
  const w = dom.window;
  w.eval(ACCESS);            // and TRPortal.embedSrc / videoFrame at render time
  w.eval(AGENTS);            // jsdom does not fetch a src, so the shared file
  w.TRAgents.mount();        // is run by hand, as the browser would run it
  w.TRLive.setProgress(data);
  w.TR_PORTAL_DATA = data;
  w.document.dispatchEvent(new w.CustomEvent('trportal:data', { detail: data }));
  const doc = w.document;
  const live = doc.querySelector('[data-curriculum-live]');
  return {
    dom, w, doc, live,
    panel: () => live.querySelector('.trp-cw-panel'),
    extra: () => doc.getElementById('cw-week1-extra'),
    pick: (n) => {
      const tab = doc.getElementById('cw-tab-' + n);
      tab.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    },
    taskRow: (title) => [...live.querySelectorAll('.trp-cw-task')]
      .find((r) => r.querySelector('.trp-cw-task-title') &&
                   r.querySelector('.trp-cw-task-title').textContent.startsWith(title)),
    lessonHead: (title) => [...live.querySelectorAll('.trp-cw-lesson')]
      .filter((r) => r.querySelector('.trp-cw-lesson-title').textContent.startsWith(title))
      .map((r) => r.querySelector('.trp-cw-lesson-head'))[0],
    lesson: (title) => [...live.querySelectorAll('.trp-cw-lesson')]
      .find((r) => r.querySelector('.trp-cw-lesson-title').textContent.startsWith(title)),
    detail: (title) => {
      const row = [...live.querySelectorAll('.trp-cw-lesson')]
        .find((r) => r.querySelector('.trp-cw-lesson-title').textContent.startsWith(title));
      return row ? row.querySelector('.trp-cw-detail') : null;
    },
    tool: () => doc.getElementById('cw-audit-tool'),
  };
}

console.log('\nThe Time Rich Pep Talk starts shut for everyone');
{
  const p = open();
  const toggle = p.live.querySelector('.trp-cw-pep-toggle');
  check('the toggle is still there', toggle !== null && toggle.textContent.includes('Time Rich Pep Talk'));
  check('and it starts shut, so the week is not pushed down',
    toggle && toggle.getAttribute('aria-expanded') === 'false',
    toggle && toggle.getAttribute('aria-expanded'));
  check('with the letter not drawn yet', p.live.querySelector('#cw-pep-body') === null);

  // The member's own click still wins, this visit.
  toggle.dispatchEvent(new p.w.MouseEvent('click', { bubbles: true }));
  const after = p.live.querySelector('.trp-cw-pep-toggle');
  check('clicking it opens it', after.getAttribute('aria-expanded') === 'true',
    after.getAttribute('aria-expanded'));
  check('with the middle of the letter showing',
    p.live.querySelector('#cw-pep-body') !== null &&
    p.live.textContent.includes('The middle of the letter'));
  p.w.close();
}

console.log('\nA member who pressed the old "I\'m in" gets it shut too');
{
  // The letter row ticked is what used to shut the Pep Talk, which meant the
  // members who had been here longest never saw it.
  const p = open([LETTER.id]);
  const toggle = p.live.querySelector('.trp-cw-pep-toggle');
  check('still shut', toggle && toggle.getAttribute('aria-expanded') === 'false',
    toggle && toggle.getAttribute('aria-expanded'));
  p.w.close();
}

console.log('\nNo Join button on the Curriculum: the Zoom link is in the invite');
{
  const p = open();
  const labels = [...p.live.querySelectorAll('a, button')].map((n) => n.textContent.trim());
  check('nothing on the page says Join via Zoom', !labels.some((l) => /join.*zoom/i.test(l)),
    labels.filter((l) => /zoom/i.test(l)));
  check('and no Zoom address is drawn into it',
    !/zoom\.us/.test(p.live.innerHTML));
  check('the page source carries no Join control at all',
    !/joinControl/.test(HTML) && !/Join live on Zoom/.test(HTML));

  // The Live Sessions page still has one: that is where a member goes for it.
  check('Live Sessions still draws one', /joinControl/.test(read('club/portal-sessions.js')));
  p.w.close();
}

console.log("\nThis week's live calls are at the top of the panel");
{
  const p = open();
  const panel = p.panel();
  const heads = [...panel.children].map((n) => n.className);

  const calls = panel.querySelector('.trp-cw-sessions');
  const lessons = panel.querySelector('.trp-cw-lessons');
  const steps = panel.querySelector('.trp-cw-steps');
  check('the calls are drawn', calls !== null, heads);
  check('and so are the lessons and the setup', lessons !== null && steps !== null);

  // The lessons and the setup sit inside their master drop-downs, so each is
  // placed by the panel child that holds it.
  const at = (n) => {
    while (n && n.parentNode !== panel) n = n.parentNode;
    return [...panel.children].indexOf(n);
  };
  check('the calls come above the lessons', at(calls) < at(lessons), [at(calls), at(lessons)]);
  check('and above the setup steps', at(calls) < at(steps), [at(calls), at(steps)]);

  const label = panel.querySelector('.trp-cw-group');
  check('they are introduced by name', label !== null && label.textContent === "This week's live calls",
    label && label.textContent);
  check('and the label is directly above them', label && label.nextElementSibling === calls);

  const tiles = [...calls.querySelectorAll('.trp-cw-session-title')].map((n) => n.textContent);
  check('both of the week\'s calls are there',
    tiles.join('|') === 'Monday masterclass|Friday hot seat', tiles);
  p.w.close();
}

console.log("\nWhat's next: one line per week, with the date it opens");
{
  const p = open();
  const box = p.live.querySelector('.trp-cw-next');
  check('the section is drawn', box !== null);
  check('and it is called What\'s next',
    box && box.querySelector('.trp-cw-next-heading').textContent === "What's next",
    box && box.querySelector('.trp-cw-next-heading').textContent);
  check('the old "Coming up" wording is gone from the page',
    !/Coming up/.test(p.live.textContent));

  const rows = [...box.querySelectorAll('.trp-cw-next-row')];
  check('three weeks still to come', rows.length === 3, rows.length);
  const read3 = rows.map((r) => [
    r.querySelector('.trp-cw-next-n').textContent,
    r.querySelector('.trp-cw-next-title').textContent,
    r.querySelector('.trp-cw-next-when').textContent,
  ]);
  check('each is the number, the title and the date it opens',
    JSON.stringify(read3) === JSON.stringify([
      ['Week 02', 'Systems', 'Opens Sun 1 Nov'],
      ['Week 03', 'Visibility', 'Opens Sun 8 Nov'],
      ['Week 04', 'Sales', 'Opens Sun 15 Nov'],
    ]), read3);

  check('the week that is open is not in it', !box.textContent.includes('Week 01'), box.textContent);
  p.w.close();
}

console.log('\nClicking anywhere on a row ticks it');
{
  const p = open();

  // A setup step: the whole row, not the 32px box in front of it.
  const row = p.taskRow('Join the Club Slack');
  check('the row is marked as tickable', row && row.classList.contains('is-tickable'),
    row && row.className);
  check('and it does not start done', row && !row.classList.contains('is-done'));

  const title = row.querySelector('.trp-cw-task-title');
  title.dispatchEvent(new p.w.MouseEvent('click', { bubbles: true }));
  check('clicking the title ticks it',
    p.w.TRLive.isItemDone(STEP) === true, p.w.TRLive.isItemDone(STEP));
  check('and the row is redrawn done',
    p.taskRow('Join the Club Slack').classList.contains('is-done'),
    p.taskRow('Join the Club Slack').className);

  // Clicking it again unticks it: the one code path, so the same state.
  p.taskRow('Join the Club Slack').querySelector('.trp-cw-task-title')
    .dispatchEvent(new p.w.MouseEvent('click', { bubbles: true }));
  check('clicking again unticks it', p.w.TRLive.isItemDone(STEP) === false);

  // The box is still a button, so the keyboard and a screen reader are
  // exactly as they were.
  const box = p.taskRow('Join the Club Slack').querySelector('.trp-check-box');
  check('the box in the row is still a real button',
    box && box.tagName === 'BUTTON' && box.hasAttribute('aria-pressed'),
    box && [box.tagName, box.getAttribute('aria-pressed')]);

  // Anything else clickable in the row keeps its own click.
  const go = p.taskRow('Join the Club Slack').querySelector('a.trp-cw-btn');
  check('the row carries its Open button', go !== null);
  go.dispatchEvent(new p.w.MouseEvent('click', { bubbles: true }));
  check('clicking that does not tick the row as well',
    p.w.TRLive.isItemDone(STEP) === false, p.w.TRLive.isItemDone(STEP));

  // A lesson row: the head ticks, and the title still opens the lesson,
  // because the title is a button of its own.
  const head = p.lessonHead('Diagnose your week');
  check('a lesson row head is tickable', head && head.classList.contains('is-tickable'),
    head && head.className);
  head.dispatchEvent(new p.w.MouseEvent('click', { bubbles: true }));
  check('clicking it ticks the lesson', p.w.TRLive.isItemDone(LESSON) === true);

  // A video cannot be ticked at all, so clicking it must do nothing rather
  // than silently fail.
  const video = p.lessonHead('Masterclass replay');
  check('a video row is not tickable', video && !video.classList.contains('is-tickable'),
    video && video.className);
  check('and its mark is not a button',
    video && video.querySelector('.trp-check-box').tagName !== 'BUTTON',
    video && video.querySelector('.trp-check-box').tagName);
  p.w.close();
}

/* ---- Week 1's static content ------------------------------------------- */

console.log("\nWeek 1's block carries the agents and the growth prompts when their lessons are missing");
{
  const p = open();
  const extra = p.extra();
  check('the block is in the page', extra !== null);
  check('and it is shown', extra && !extra.hasAttribute('hidden'));
  check('inside the Week 1 panel', extra && p.panel().contains(extra));
  check('last in it, under the lessons and the setup',
    extra && p.panel().lastElementChild === extra, extra && p.panel().lastElementChild.className);

  const order = [...extra.querySelectorAll('.trp-cw-w1-sec')]
    .map((s) => {
      const h = s.querySelector('.trp-cw-w1-h') || s.querySelector('.trp-section-title');
      return h ? h.textContent : s.id;
    });
  /* This payload has no "Pick your personal AI agent" or "10 Growth
     Prompts" lesson, so their blocks are drawn here, where they always
     were. With the lessons, they move into them (tested further down). */
  check('the agents and the growth prompts, in Ella\'s order',
    JSON.stringify(order) === JSON.stringify([
      'Which personal AI agent should you start with?',
      'growth-prompts',
    ]), order);
  check('and the cohort\'s questions are off the page',
    p.doc.getElementById('cohort-questions') === null && !/Questions from the cohort/.test(p.live.textContent));
  check('and no Next steps list: the lessons say all of it',
    extra.querySelector('#cw-nextsteps-h') === null && !/Next steps/.test(extra.textContent));

  // One audit on the page, and it is in its lesson.
  check('one audit table, in the audit lesson',
    p.live.querySelectorAll('.trp-cw-audit').length === 1 &&
    p.detail('Run your Time Rich Audit').querySelector('.trp-cw-audit') !== null,
    p.live.querySelectorAll('.trp-cw-audit').length);
  p.w.close();
}

console.log('\nThe Time Rich Audit is in its lesson: the prompt, then the table');
{
  /* One audit, in the lesson of the same name: the prompt from the Supabase
     row in its copy box, and the table under it, so the member types in the
     place they are already reading. */
  const p = open();
  const row = p.lesson('Run your Time Rich Audit');
  const detail = p.detail('Run your Time Rich Audit');
  check('the lesson is there, with its tick',
    row !== undefined && row.querySelector('.trp-check-box').tagName === 'BUTTON');
  check('at the address Resources links to', row && row.id === 'time-rich-audit', row && row.id);
  check('and no audit section is left in the Week 1 block',
    p.extra().querySelector('#cw-audit-h') === null);

  const tool = p.tool();
  check('the table is in the lesson', tool !== null && detail.contains(tool));
  check('and it is shown', tool && !tool.hasAttribute('hidden'));

  const box = detail.querySelector('.trp-cw-pb');
  check('the prompt is in a copy box', box !== null);
  check('named Your audit prompt',
    box && box.querySelector('.trp-cw-pb-label').textContent === 'Your audit prompt',
    box && box.querySelector('.trp-cw-pb-label').textContent);
  check('holding the whole prompt, blank lines and all',
    box && box.querySelector('pre').textContent === AUDIT_PROMPT,
    box && JSON.stringify(box.querySelector('pre').textContent));
  check('and the prompt comes above the table',
    box && tool && (box.compareDocumentPosition(tool) & p.w.Node.DOCUMENT_POSITION_FOLLOWING) !== 0);

  let copiedPrompt = null;
  p.w.navigator.clipboard = { writeText: (t) => { copiedPrompt = t; return Promise.resolve(); } };
  box.querySelector('[data-copy-target]').dispatchEvent(new p.w.MouseEvent('click', { bubbles: true }));
  check('Copy puts exactly that on the clipboard', copiedPrompt === AUDIT_PROMPT, copiedPrompt);

  const heads = [...tool.querySelectorAll('thead th')].map((th) => th.textContent);
  check('the five columns from the Business COMPASS',
    JSON.stringify(heads) === JSON.stringify([
      'Task (last week)', 'Hours', '$ or not',
      'Owner: Skill, Agent, Human or Me', 'COMPASS check',
    ]), heads);

  const rows = [...tool.querySelectorAll('.trp-cw-audit-row')];
  check('five rows to start', rows.length === 5, rows.length);
  const inputs = [...tool.querySelectorAll('input[type="text"]')];
  check('every cell is a text box', inputs.length === 26, inputs.length);
  check('and nothing is filled in', inputs.every((i) => i.value === ''),
    inputs.map((i) => i.value).filter(Boolean));

  const first = [...rows[0].querySelectorAll('input')].map((i) => i.getAttribute('placeholder'));
  check('the example is the first row\'s placeholders',
    JSON.stringify(first) === JSON.stringify([
      'Example: rewrote sales page copy', '3', 'Not', 'Skill',
      "Sells an offer on my COMPASS, but the writing isn't mine to do",
    ]), first);
  check('every box is labelled for a screen reader',
    inputs.every((i) => (i.getAttribute('aria-label') || '').length > 3));
  check('the table is in no form', tool.closest('form') === null);
}

console.log('\nA row body can open a copy box of its own');
{
  const p = open();
  const detail = p.detail('Say hello in #introductions');
  check('the row is drawn', Boolean(detail));

  const box = detail.querySelector('.trp-cw-pb');
  check('the "= Copy:" line became a box', box !== null, detail.innerHTML.slice(0, 120));
  check('named by the rest of that line',
    box && box.querySelector('.trp-cw-pb-label').textContent === 'Your intro',
    box && box.querySelector('.trp-cw-pb-label').textContent);
  check('holding exactly the lines under it',
    box && box.querySelector('pre').textContent === INTRO_TEXT,
    box && JSON.stringify(box.querySelector('pre').textContent));

  // The marker line itself is never shown.
  check('the marker is not drawn as copy',
    !detail.textContent.includes('= Copy:'), detail.textContent.slice(0, 80));
  check('and the line above it still is',
    detail.textContent.includes('Introduce yourself in Slack in this format.'));

  // The box ends at the blank line before the drop-down, not at the end of
  // the body: this is what stops it swallowing the channels list.
  const more = detail.querySelector('details.trp-cw-more');
  check('the drop-down after it is still a drop-down', more !== null);
  check('named as it was written',
    more && more.querySelector('summary span').textContent === 'The channels, and where to ask',
    more && more.querySelector('summary span').textContent);
  check('and the box did not swallow it',
    box && !box.querySelector('pre').textContent.includes('#introductions'),
    box && box.querySelector('pre').textContent);

  // Copy copies exactly that block.
  let copied = null;
  p.w.navigator.clipboard = { writeText: (t) => { copied = t; return Promise.resolve(); } };
  box.querySelector('[data-copy-target]').dispatchEvent(new p.w.MouseEvent('click', { bubbles: true }));
  check('Copy puts that block on the clipboard, and nothing else',
    copied === INTRO_TEXT, copied);

  // A tick redraws the panel; the button still works afterwards, because
  // the listener is on the document rather than on the button.
  p.taskRow('Join the Club Slack').querySelector('.trp-cw-task-title')
    .dispatchEvent(new p.w.MouseEvent('click', { bubbles: true }));
  copied = null;
  p.detail('Say hello in #introductions').querySelector('[data-copy-target]')
    .dispatchEvent(new p.w.MouseEvent('click', { bubbles: true }));
  check('and still works after a redraw', copied === INTRO_TEXT, copied);

  // A row with no marker is unchanged.
  check('a plain body is still plain',
    p.detail('Diagnose your week').querySelector('.trp-cw-pb') === null);
  p.w.close();
}

console.log('\nA body written on Windows works the same');
{
  /* The migration that writes this body is dollar-quoted SQL, and a
     checkout on Windows turns every line ending in it into a carriage
     return and a newline. Pasted into Supabase that way, the carriage
     returns go into the row. The renderer normalises them, or the "= Copy:"
     line never matches and the member sees the marker as copy. */
  const crlf = JSON.parse(JSON.stringify(payload()));
  const row = crlf.weeks[1].items.find((i) => i.title === 'Say hello in #introductions');
  row.body = row.body.replace(/\n/g, '\r\n');

  const p = openWith(crlf);
  const detail = p.detail('Say hello in #introductions');
  const box = detail.querySelector('.trp-cw-pb');
  check('the copy box is still drawn', box !== null, detail.textContent.slice(0, 80));
  check('the marker is still not shown', !detail.textContent.includes('= Copy:'));
  check('and the text in it has no carriage returns left',
    box && box.querySelector('pre').textContent === INTRO_TEXT,
    box && JSON.stringify(box.querySelector('pre').textContent));
  check('the drop-down after it survived too',
    detail.querySelector('details.trp-cw-more') !== null);
  p.w.close();
}

console.log('\nAdd a row, and Copy table');
{
  const p = open();
  const extra = p.tool();

  const add = extra.querySelector('[data-audit-add]');
  check('there is an Add a row button', add !== null && add.textContent.trim() === 'Add a row');
  add.dispatchEvent(new p.w.MouseEvent('click', { bubbles: true }));
  check('it adds one', extra.querySelectorAll('.trp-cw-audit-row').length === 6,
    extra.querySelectorAll('.trp-cw-audit-row').length);
  const fresh = [...extra.querySelectorAll('.trp-cw-audit-row')][5];
  check('empty, and with no example on it',
    [...fresh.querySelectorAll('input')].every((i) => i.value === '' && !i.hasAttribute('placeholder')));

  // Type a row, then copy. What is copied is what was typed, plain.
  const cells = [...extra.querySelectorAll('.trp-cw-audit-row')][0].querySelectorAll('input');
  const typed = ['Wrote the newsletter', '2', 'Not', 'Skill', 'On my COMPASS'];
  typed.forEach((value, i) => {
    cells[i].value = value;
    cells[i].dispatchEvent(new p.w.Event('input', { bubbles: true }));
  });
  extra.querySelector('[data-audit-revenue]').value = '18';
  extra.querySelector('[data-audit-revenue]').dispatchEvent(new p.w.Event('input', { bubbles: true }));

  let copied = null;
  p.w.navigator.clipboard = { writeText: (t) => { copied = t; return Promise.resolve(); } };
  const copy = extra.querySelector('[data-audit-copy]');
  check('there is a Copy table button', copy !== null && copy.textContent.trim() === 'Copy table');
  copy.dispatchEvent(new p.w.MouseEvent('click', { bubbles: true }));

  check('it copies the heads and the row that was typed',
    copied && copied.split('\n')[0].split('\t')[0] === 'Task (last week)' &&
    copied.includes(typed.join('\t')), copied);
  check('the empty rows are left out', copied && copied.split('\n').filter((l) => l.trim()).length === 3,
    copied && copied.split('\n'));
  check('and the revenue number comes with it',
    copied && copied.includes('Revenue number: $ hours divided by total hours = 18%'), copied);
  p.w.close();
}

console.log('\nWhat is typed survives a redraw and a reload');
{
  const p = open();
  const cells = p.tool().querySelectorAll('.trp-cw-audit-row input');
  cells[0].value = 'Wrote the newsletter';
  cells[0].dispatchEvent(new p.w.Event('input', { bubbles: true }));

  // A tick anywhere redraws the panel around the block.
  p.taskRow('Join the Club Slack').querySelector('.trp-cw-task-title')
    .dispatchEvent(new p.w.MouseEvent('click', { bubbles: true }));
  check('a tick elsewhere does not clear the audit',
    p.tool().querySelector('.trp-cw-audit-row input').value === 'Wrote the newsletter',
    p.tool().querySelector('.trp-cw-audit-row input').value);

  // And moving between weeks.
  p.pick(2);
  check('week 2 does not carry the block', !p.panel().contains(p.extra()));
  check('nor the audit table', p.panel().querySelector('.trp-cw-audit') === null);
  p.pick(1);
  check('coming back brings both, and the typing with them',
    p.panel().contains(p.extra()) && p.panel().contains(p.tool()) &&
    p.tool().querySelector('.trp-cw-audit-row input').value === 'Wrote the newsletter',
    p.tool().querySelector('.trp-cw-audit-row input').value);

  check('and it is kept in this browser only, under one key',
    JSON.parse(p.w.localStorage.getItem('tr_audit_rows')).rows[0][0] === 'Wrote the newsletter',
    p.w.localStorage.getItem('tr_audit_rows'));
  p.w.close();
}

console.log('\nAudacious Action: one toggle, shut, with a drop-down per prompt');
{
  const p = open();
  const section = p.extra().querySelector('#growth-prompts');
  check('the section is there, at the address Resources links to', section !== null);

  /* One toggle for the lot, shut to begin with: not every member is ready
     for this in week 1, and ten open prompts read as homework. */
  check('it is a toggle', section.tagName === 'DETAILS');
  check('and it starts shut', section.open === false);
  const summary = section.querySelector(':scope > summary');
  check('whose title is Ella\'s',
    summary.textContent.replace(/\s+/g, ' ').trim().startsWith('Audacious Action 10 growth prompts'),
    summary.textContent.replace(/\s+/g, ' ').trim());
  check('in the same shape as the setup steps above it',
    section.classList.contains('trp-cw-step'));

  // Open it and the intro and the challenge are the first things there.
  check('the intro line is hers',
    section.textContent.includes('Your first agent goes where the money is. Your moat is your expertise, trust, creativity and distribution, so growth comes first.'));

  const callout = section.querySelector('.trp-cw-callout');
  check('the challenge is called out', callout !== null);
  const inner = section.querySelector(':scope > .trp-cw-gp-body');
  check('and it comes before the first prompt drop-down',
    [...inner.children].indexOf(callout) < [...inner.children].indexOf(inner.querySelector('.trp-cw-gpd')));
  check('it names the channel',
    callout.textContent.includes('#audacious-wins'), callout.textContent);
  check('and the one-prompt challenge, before Friday',
    /pick ONE prompt below, run it in a chat inside your Business Hub before Friday/.test(callout.textContent));
  check('the Wispr Flow line is there',
    section.textContent.includes('Speak your answers with Wispr Flow.'));

  /* Each prompt is a drop-down of its own, titled without the letters they
     carried on Ella's Notion page. */
  const drops = [...section.querySelectorAll('.trp-cw-gpd')];
  check('ten drop-downs, one per prompt', drops.length === 10, drops.length);
  check('all shut to begin with', drops.every((d) => d.open === false));
  check('each in the setup-step shape',
    drops.every((d) => d.tagName === 'DETAILS' && d.classList.contains('trp-cw-step')));

  const titles = drops.map((d) => d.querySelector('.trp-cw-step-title').textContent);
  check('titled in Ella\'s words, with no letters or numbers',
    JSON.stringify(titles) === JSON.stringify([
      'ICP agent: know exactly who you sell to',
      'Boardy: your AI superconnector (free)',
      'Hot lead extractor',
      'Follow-up in AI',
      'Audacious outbound',
      'Audacious give',
      'Partnerships strategy',
      'Virtual calls',
      'Sales call analyser',
      'Cashflow check',
    ]), titles);

  // A has two prompts (with calls, and without), the rest one each.
  const boxes = [...section.querySelectorAll('.trp-cw-pb')];
  check('eleven prompt boxes: the ICP one keeps both', boxes.length === 11, boxes.length);
  check('the ICP drop-down holds both of them',
    drops[0].querySelectorAll('.trp-cw-pb').length === 2 &&
    [...drops[0].querySelectorAll('.trp-cw-pb-label')].map((n) => n.textContent).join('|') ===
      'With calls|No calls yet',
    [...drops[0].querySelectorAll('.trp-cw-pb-label')].map((n) => n.textContent));
  check('every one has a Copy button',
    boxes.every((b) => b.querySelector('[data-copy-target]')));
  check('and each button points at its own prompt',
    boxes.every((b) => b.querySelector('[data-copy-target]').getAttribute('data-copy-target') ===
      b.querySelector('pre').id));

  const first = boxes[0].querySelector('pre').textContent;
  check('the first prompt is the ICP one, word for word',
    first.startsWith('Build my ICP from my sales call notes in Wispr Flow.') &&
    first.includes("then tell me the 3 points you're least sure about."), first.slice(0, 60));
  check('and every prompt ends with the master prompt',
    boxes.every((b) => {
      const t = b.querySelector('pre').textContent;
      return t.includes('\n\nBefore you start:\n- Restate my goal in one line') &&
        t.endsWith("saved to my Business COMPASS, so you're smarter next time.");
    }));
  check('no prompt is indented', boxes.every((b) => !/^\s/.test(b.querySelector('pre').textContent)));

  /* The one link in here is a button, not a line of address text. */
  const links = [...section.querySelectorAll('a[href]')];
  check('Boardy is the only link, and it is a button',
    links.length === 1 && links[0].classList.contains('trp-cw-btn'),
    links.map((a) => [a.getAttribute('href'), a.className]));
  check('it says what it does',
    links[0].textContent === 'Sign up to Boardy', links[0].textContent);
  check('goes where Ella sent it, in a new tab',
    links[0].getAttribute('href') === 'https://boardy.ai/links/zTblS' &&
    links[0].getAttribute('target') === '_blank' &&
    /noopener/.test(links[0].getAttribute('rel')),
    [links[0].getAttribute('href'), links[0].getAttribute('rel')]);
  check('and no bare address is printed anywhere in the section',
    !/boardy\.ai\/links/.test(section.textContent), section.textContent.slice(0, 80));

  // Copy really copies, from inside a shut drop-down.
  let copied = null;
  p.w.navigator.clipboard = { writeText: (t) => { copied = t; return Promise.resolve(); } };
  const btn = boxes[2].querySelector('[data-copy-target]');
  btn.dispatchEvent(new p.w.MouseEvent('click', { bubbles: true }));
  check('clicking Copy puts that prompt on the clipboard',
    copied === boxes[2].querySelector('pre').textContent, copied && copied.slice(0, 40));
  await new Promise((r) => setTimeout(r, 0));
  check('and the button says so', btn.textContent === 'Copied', btn.textContent);
  p.w.close();
}


console.log('\nThe agent table and the growth prompts sit in their own lessons');
{
  const AGENTS_LESSON = { id: 205, kind: 'text', title: 'Pick your personal AI agent', body: 'Pick one.', sort: 60 };
  const GROWTH_LESSON = { id: 206, kind: 'text', title: '10 Growth Prompts', body: 'Run ONE before Friday.', sort: 80 };
  const data = payload();
  data.weeks[1].items.push(AGENTS_LESSON, GROWTH_LESSON);
  const p = openWith(data);

  const agents = p.lesson('Pick your personal AI agent');
  check('the agent lesson carries the shared table',
    agents && agents.querySelector('[data-agents-block] .trp-agents') !== null);
  check('and answers to its address', agents && agents.id === 'which-agent', agents && agents.id);
  check('the Week 1 block does not draw it a second time',
    p.live.querySelectorAll('[data-agents-block]').length === 1);

  const growth = p.lesson('10 Growth Prompts');
  check('the growth lesson carries the ten prompts, without a toggle of its own',
    growth && growth.querySelectorAll('.trp-cw-gpd').length === 10 &&
    growth.querySelector('details#growth-prompts') === null);
  check('and answers to its address', growth && growth.id === 'growth-prompts', growth && growth.id);
  check('the empty toggle is hidden in the Week 1 block',
    [...p.extra().querySelectorAll('details.trp-cw-w1-sec')].every((d) => d.hidden));
  check('one element answers to each address',
    p.doc.querySelectorAll('[id="growth-prompts"]').length === 1 &&
    p.doc.querySelectorAll('[id="which-agent"]').length === 1);

  // A link from Resources opens the lesson it lands on.
  const q = openWith(data, '#growth-prompts');
  const landed = q.lesson('10 Growth Prompts');
  check('a link to it opens that lesson',
    landed && landed.querySelector('.trp-cw-toggle').getAttribute('aria-expanded') === 'true');
  q.w.close();
  p.w.close();
}

console.log('\nA copy box marks the key words and drops "Copy" from its label');
{
  const LESSON = { id: 207, kind: 'text', title: 'Key words', sort: 45,
    body: 'Try it.\n\n= Copy the prompt\nRead my COMPASS. **Never send anything.**\n=' };
  const data = payload();
  data.weeks[1].items.push(LESSON);
  const p = openWith(data);
  const box = p.detail('Key words').querySelector('.trp-cw-pb');
  check('the label reads Prompt',
    box && box.querySelector('.trp-cw-pb-label').textContent === 'Prompt',
    box && box.querySelector('.trp-cw-pb-label').textContent);
  const mark = box && box.querySelector('pre mark.trp-cw-key');
  check('the starred words are marked', mark && mark.textContent === 'Never send anything.');
  check('and the stars never reach the copy',
    box && box.querySelector('pre').textContent === 'Read my COMPASS. Never send anything.',
    box && box.querySelector('pre').textContent);
  p.w.close();
}

console.log('\nThe setup and the week are master drop-downs');
{
  const p = open();
  const masters = [...p.panel().querySelectorAll('details.trp-cw-master')];
  const titles = masters.map((d) => d.querySelector('.trp-cw-master-title').textContent);
  check('the setup is one, first, and open while any of it is left',
    titles[0] === 'Your setup' && masters[0].open === true, titles);
  check('the lessons are in sections of the week, all shut while the setup is left',
    masters.slice(1).length > 0 && masters.slice(1).every((d) => d.open === false), titles);
  check('every lesson is in a section',
    [...p.panel().querySelectorAll('.trp-cw-lesson')].every((l) => l.closest('details.trp-cw-master')));
  check('each section says how much of it is done',
    masters.every((d) => /\d+ of \d+ done/.test(d.querySelector('.trp-cw-master-count').textContent)));

  // Once the setup is done, it shuts and the section with the next lesson opens.
  const q = open([STEP.id]);
  const qm = [...q.panel().querySelectorAll('details.trp-cw-master')];
  const setup = qm.find((d) => d.querySelector('.trp-cw-master-title').textContent === 'Your setup');
  check('a finished setup is shut', setup && setup.open === false);
  check('and the section holding the next lesson is open',
    qm.filter((d) => d.open).length === 1 &&
    qm.find((d) => d.open).querySelector('.trp-cw-lesson.is-open') !== null);
  q.w.close();
  p.w.close();
}

console.log('\nAn open lesson folds from a click in its body, not from its controls');
{
  const p = open();
  const toggle = () => p.lesson('Run your Time Rich Audit').querySelector('.trp-cw-toggle');
  toggle().dispatchEvent(new p.w.MouseEvent('click', { bubbles: true }));
  check('it opens from its title', toggle().getAttribute('aria-expanded') === 'true');
  p.tool().querySelector('.trp-cw-audit-in').dispatchEvent(new p.w.MouseEvent('click', { bubbles: true }));
  check('a click in the audit table leaves it open', toggle().getAttribute('aria-expanded') === 'true');
  p.detail('Run your Time Rich Audit').querySelector('.trp-cw-lesson-body')
    .dispatchEvent(new p.w.MouseEvent('click', { bubbles: true }));
  check('a click on its text folds it', toggle().getAttribute('aria-expanded') === 'false');
  p.w.close();
}

console.log('\nA link from Resources lands on the growth prompts');
{
  // Week 1 is not the week the page would pick on its own if a later week
  // were open, and the section does not exist until Week 1 is drawn, so the
  // hash has to pick the week before it can scroll.
  const p = open(undefined, '#growth-prompts');
  check('Week 1 is the week on screen',
    p.doc.getElementById('cw-tab-1').getAttribute('aria-selected') === 'true',
    p.doc.getElementById('cw-tab-1').getAttribute('aria-selected'));
  check('and the section is in the page to land on',
    p.doc.getElementById('growth-prompts') !== null);

  // The member's own choice of week wins after that.
  p.pick(2);
  check('picking another week still works',
    p.doc.getElementById('cw-tab-2').getAttribute('aria-selected') === 'true');
  p.w.close();
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
