// Cohort 1 is over: TRLive.cohortEnded is the one rule that says so.
//
// The Curriculum called Week 4 "This week" for as long as the page was open,
// because "this week" was only ever "the newest week whose calls have
// started" -- a test that stays true forever once the last call has run.
// cohortEnded is the other half: every call is well behind us, so no week is
// "this week" any more and the badges all read "Open".
//
// The 12-hour slack is the same one weekStarted() uses, so the day of the
// last call still counts as live.
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';

const LIVE = readFileSync(new URL('../../club/portal-live.js', import.meta.url), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://timerich.ai/club/curriculum',
  runScripts: 'outside-only',
  virtualConsole: new VirtualConsole(),
});
dom.window.eval(LIVE);
const L = dom.window.TRLive;

// Cohort 1: the last call was Friday 20 November 2026, 12pm ET (17:00 UTC).
const LAST = '2026-11-20T17:00:00.000Z';
const payload = (sessions) => ({ ok: true, weeks: [], sessions, progress: { items: [], sessions: [] } });
const session = (id, iso) => ({ id, week_id: 4, title: 'Call ' + id, starts_at: iso });
const hours = (iso, n) => new Date(Date.parse(iso) + n * 3600 * 1000);

console.log('\nTRLive.cohortEnded -- has the cohort finished?');
{
  check('no sessions at all: nothing has been scheduled, so it has not ended',
    L.cohortEnded(payload([]), new Date(LAST)) === false);

  check('a payload with no sessions key at all: still false',
    L.cohortEnded({ ok: true }, new Date(LAST)) === false);

  check('one session still ahead of us: not ended',
    L.cohortEnded(payload([session(1, LAST)]), hours(LAST, -24)) === false);

  check('the last call ran an hour ago: still live, the day is not over',
    L.cohortEnded(payload([session(1, LAST)]), hours(LAST, 1)) === false);

  check('12 hours after the last call, to the minute: still live',
    L.cohortEnded(payload([session(1, LAST)]), hours(LAST, 12)) === false);

  const four = [
    session(1, '2026-10-26T16:00:00.000Z'),
    session(2, '2026-11-02T17:00:00.000Z'),
    session(3, '2026-11-13T17:00:00.000Z'),
    session(4, LAST),
  ];
  check('every call more than 12 hours past: the cohort is a wrap',
    L.cohortEnded(payload(four), hours(LAST, 13)) === true);

  check('the Monday after the last call: a wrap',
    L.cohortEnded(payload(four), new Date('2026-11-23T12:00:00.000Z')) === true);

  check('three weeks done and the fourth still to come: not ended',
    L.cohortEnded(payload(four), hours('2026-11-13T17:00:00.000Z', 13)) === false);

  // Cohort 2 lands in the payload and the page is live again by itself.
  check('a Cohort 2 call on the books: not ended any more',
    L.cohortEnded(payload(four.concat([session(5, '2027-02-01T17:00:00.000Z')])), hours(LAST, 13)) === false);

  // A session with no usable date cannot be shown to be past, so it holds
  // the cohort open rather than quietly ending it.
  check('a session with an unparseable date: not ended',
    L.cohortEnded(payload([session(1, LAST), session(2, 'not a date')]), hours(LAST, 13)) === false);

  check('it is exported, so the pages can read it',
    typeof L.cohortEnded === 'function');

  // Defaults to the real clock, like weekStarted, so the pages can call it
  // with the payload alone.
  check('called with no clock: still answers',
    typeof L.cohortEnded(payload(four)) === 'boolean');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
