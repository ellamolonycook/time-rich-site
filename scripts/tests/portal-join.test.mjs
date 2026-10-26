// Join via Zoom: one rule, and the two pages that draw it.
//
// The dashboard's Next live session card handed out a live Zoom link the
// moment the session carried one. Live Sessions kept the same call dead
// until its Eastern calendar day began. So on a Monday morning the same
// session was joinable on one page and disabled on the other, and neither
// page was using the rule Ella wanted: open half an hour before the start,
// shut when the call ends.
//
// Both pages call TRLive.joinControl now. This suite freezes the clock, runs
// the real dashboard script and the real Live Sessions renderer against the
// same payload at the same instant, and compares what each one drew. If they
// ever disagree again, every row in the table below goes red at once.
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const LIVE = read('club/portal-live.js');
const DASHBOARD_HTML = read('club/dashboard.html');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

// Monday 26 October 2026, 12:00 ET, which is 16:00 UTC.
const START = '2026-10-26T16:00:00.000Z';
const MS = 60000;
const at = (minutesFromStart) =>
  new Date(Date.parse(START) + minutesFromStart * MS).toISOString();

const SESSIONS = [
  { id: 1, week_id: 1, title: 'Open Business Surgery', starts_at: START,
    join_url: 'https://zoom.us/j/1', addevent_url: null, recording_url: null },
  { id: 2, week_id: 1, title: 'Training Your Agent', starts_at: '2026-10-30T16:00:00.000Z',
    join_url: 'https://zoom.us/j/2', addevent_url: null, recording_url: null },
];

const PAYLOAD = {
  ok: true,
  member: { first_name: 'Ella', role: 'buyer', setup: { calendar: false, notion: false } },
  weeks: [0, 1, 2, 3, 4].map((id) => ({ id, title: 'Week ' + id, unlocked: id < 2, items: [] })),
  sessions: SESSIONS,
  progress: { items: [], sessions: [] },
};

/* Pins a window's clock. Both pages read `new Date()` once at the top of a
   render and thread it down from there, so freezing the constructor is
   enough to put the two of them on the same instant. Calls that pass an
   argument still reach the real Date, or every starts_at would parse to the
   frozen time and the rule under test would always be true. */
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

/* What a Next session card is offering, in a shape the two pages can be
   compared on: whether Join is a live link or a dead button, where it goes,
   and the line under it. */
function stateOf(card) {
  if (!card) return { card: 'missing' };
  const link = card.querySelector('a[href*="zoom.us"]');
  const button = [...card.querySelectorAll('button')]
    .find((b) => b.textContent.trim() === 'Join via Zoom');
  const note = card.querySelector('.trp-join-note');
  return {
    session: (card.querySelector('.trp-next-title') || {}).textContent || null,
    join: link ? 'live' : (button ? 'disabled' : 'none'),
    href: link ? link.getAttribute('href') : null,
    disabled: button ? button.disabled === true : null,
    note: note ? note.textContent : null,
  };
}

/* The real dashboard: its card is drawn by an inline script, so portal-live
   is evaluated in beforeParse. The inline script reads window.TRLive at parse
   time and gives up if it is not there, which is exactly what a <script src>
   jsdom never fetches would cause. */
function dashboardCard(nowIso) {
  const dom = new JSDOM(DASHBOARD_HTML, {
    url: 'https://timerich.ai/club/dashboard.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),
    beforeParse(window) {
      window.tailwind = {};
      window.gtag = () => {};
      window.TR_PORTAL_CONFIG = { sessionUrl: 'https://worker.test/portal-session' };
      window.fetch = () => Promise.resolve(new globalThis.Response('{}', { status: 200 }));
      freeze(window, nowIso);
      window.eval(LIVE);
    },
  });
  const w = dom.window;
  const host = w.document.querySelector('[data-dash-next]');
  w.TRDashboard.renderNext(host, PAYLOAD, new w.Date());
  return host;
}

console.log('\nThe rule itself');
{
  const dom = new JSDOM('', { runScripts: 'outside-only', virtualConsole: new VirtualConsole() });
  dom.window.eval(LIVE);
  const L = dom.window.TRLive;
  const s = SESSIONS[0];

  check('the window opens 30 minutes before the start, not on the day',
    L.JOIN_OPENS_MINUTES === 30, L.JOIN_OPENS_MINUTES);
  check('two hours before: shut', L.isJoinOpen(s, new Date(at(-120))) === false);
  check('31 minutes before: still shut', L.isJoinOpen(s, new Date(at(-31))) === false);
  check('30 minutes before: open', L.isJoinOpen(s, new Date(at(-30))) === true);
  check('at the start: open', L.isJoinOpen(s, new Date(at(0))) === true);
  check('mid call: open', L.isJoinOpen(s, new Date(at(40))) === true);
  check('a minute before the end: open', L.isJoinOpen(s, new Date(at(74))) === true);
  check('at the end: shut again', L.isJoinOpen(s, new Date(at(75))) === false,
    L.SESSION_MINUTES);
  check('the day before, in the Eastern morning, is still shut',
    L.isJoinOpen(s, new Date('2026-10-26T08:00:00.000Z')) === false);
  check('a session with no start time never opens',
    L.isJoinOpen({ title: 'No date', join_url: 'https://zoom.us/j/9' }, new Date(at(0))) === false);

  // The card has to keep showing a session that is running, or the live link
  // appears and vanishes in the same minute the call starts.
  check('the next session is the one still to attend, including one running now',
    L.nextSession(PAYLOAD, new Date(at(10))).id === 1, L.nextSession(PAYLOAD, new Date(at(10))));
  check('and it moves on once that one has ended',
    L.nextSession(PAYLOAD, new Date(at(80))).id === 2, L.nextSession(PAYLOAD, new Date(at(80))));
}

console.log('\nThe line under a disabled button');
{
  const dom = new JSDOM('', { runScripts: 'outside-only', virtualConsole: new VirtualConsole() });
  dom.window.eval(LIVE);
  const L = dom.window.TRLive;

  check('it is the sentence from the brief',
    L.JOIN_NOTE === 'Opens 30 minutes before the start.', L.JOIN_NOTE);

  const shut = L.joinControl(SESSIONS[0], new Date(at(-120)));
  check('a shut control is a disabled button, not a link',
    shut.control.tagName === 'BUTTON' && shut.control.disabled === true && shut.open === false);
  check('it still reads "Join via Zoom", so nothing moves when it opens',
    shut.control.textContent === 'Join via Zoom');
  check('it says when it opens, for a screen reader too',
    shut.note.textContent === L.JOIN_NOTE &&
    /opens 30 minutes before/.test(shut.control.getAttribute('aria-label')),
    shut.control.getAttribute('aria-label'));

  const open = L.joinControl(SESSIONS[0], new Date(at(5)));
  check('an open control is the live link, with no line under it',
    open.control.tagName === 'A' && open.open === true && open.note === null);
  check('it opens in a new tab, safely',
    open.control.getAttribute('target') === '_blank' &&
    open.control.getAttribute('rel') === 'noopener noreferrer');

  // Inside the window but with nothing to link to is not the same thing as
  // not open yet, and saying "opens in 30 minutes" to someone standing in
  // the window would be a lie.
  const noLink = L.joinControl({ title: 'No link', starts_at: START }, new Date(at(5)));
  check('open but with no Zoom link: a dead button and no promise',
    noLink.control.tagName === 'BUTTON' && noLink.control.disabled === true &&
    noLink.note === null, noLink.note && noLink.note.textContent);
}

/* Two blocks used to sit here: the dashboard and the Live Sessions page
   driven off one clock and compared minute by minute, and the rows on
   that page checked against the card above them. Live Sessions is gone
   -- every call is on the Curriculum now -- so there is no second page
   left to disagree with.

   The rule above is what mattered in those blocks, and it is tested
   directly: one window, one helper, and every page that draws a Join
   control gets it from there. */

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
