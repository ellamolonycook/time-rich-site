// Add to Calendar tests.
//
// The portal used to build an .ics in the browser and offer a
// Google/Outlook/Apple pop-up, then one Add Event link per session. Both are
// gone from the page: there is one link at the top of Live Sessions that
// subscribes to the whole cohort schedule, and no button on a row or on the
// next session card.
//
// TRLive.calendarLink is kept and still tested. It is the one piece that
// would have to be written again from scratch if a per-session button ever
// came back, and it costs nothing to leave standing; the second block below
// is what proves nothing on the page calls it.
//
// These load portal-live.js the way a page does and drive the helper.
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';

const LIVE = readFileSync(new URL('../../portal/portal-live.js', import.meta.url), 'utf8');
const SESSIONS_JS = readFileSync(new URL('../../portal/portal-sessions.js', import.meta.url), 'utf8');
const SESSIONS_HTML = readFileSync(new URL('../../portal/sessions.html', import.meta.url), 'utf8');
const SUBSCRIBE_URL = 'https://www.addevent.com/calendar/z0j4nlqbgt6b';

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  -> ' + JSON.stringify(extra) : '')); }
}

function boot() {
  const vc = new VirtualConsole();
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://timerich.ai/portal/sessions.html',
    runScripts: 'dangerously',
    virtualConsole: vc,
  });
  const script = dom.window.document.createElement('script');
  script.textContent = LIVE;
  dom.window.document.body.appendChild(script);
  return dom.window;
}

const w = boot();
const L = w.TRLive;

const WITH_LINK = {
  title: 'Open Business Surgery',
  starts_at: '2026-10-26T16:00:00+00:00',
  join_url: 'https://zoom.us/j/1',
  addevent_url: 'https://www.addevent.com/event/ab123456',
};
const NO_LINK = { title: 'Training Your Agent', starts_at: '2026-10-30T16:00:00+00:00', addevent_url: null };

console.log('\nTRLive exposes the Add Event helper and nothing else');
{
  check('TRLive loaded', Boolean(L), typeof L);
  check('calendarLink is there', typeof L.calendarLink === 'function');
  check('addEventUrl is there', typeof L.addEventUrl === 'function');
  // The pop-up and everything that fed it are gone, not just unused.
  check('calendarMenu is gone', L.calendarMenu === undefined);
  check('icsBlobUrl is gone', L.icsBlobUrl === undefined);
  check('googleCalendarUrl is gone', L.googleCalendarUrl === undefined);
  check('outlookCalendarUrl is gone', L.outlookCalendarUrl === undefined);
}

console.log('\nA session with an Add Event link');
{
  const a = L.calendarLink(WITH_LINK, 'Add to calendar', 'btn');
  check('returns a link', Boolean(a) && a.tagName === 'A', a && a.tagName);
  check('pointing at addevent_url', a.getAttribute('href') === WITH_LINK.addevent_url, a && a.getAttribute('href'));
  check('opening in a new tab', a.getAttribute('target') === '_blank', a && a.getAttribute('target'));
  check('safely', a.getAttribute('rel') === 'noopener noreferrer', a && a.getAttribute('rel'));
  check('with the text it was given', a.textContent === 'Add to calendar', a && a.textContent);
  check('and the class it was given', a.className === 'btn', a && a.className);
  check('named for a screen reader',
    (a.getAttribute('aria-label') || '').includes('Open Business Surgery'), a && a.getAttribute('aria-label'));
}

console.log('\nA session with no Add Event link');
{
  check('null addevent_url gives no button', L.calendarLink(NO_LINK, 'Add to calendar', 'btn') === null);
  check('an empty string gives no button',
    L.calendarLink({ ...NO_LINK, addevent_url: '' }, 'x', 'btn') === null);
  check('whitespace gives no button',
    L.calendarLink({ ...NO_LINK, addevent_url: '   ' }, 'x', 'btn') === null);
  check('a missing field gives no button',
    L.calendarLink({ title: 'No field', starts_at: NO_LINK.starts_at }, 'x', 'btn') === null);
}

console.log('\nThe link has to be https, like every other URL the portal shows');
{
  check('http is refused',
    L.calendarLink({ ...WITH_LINK, addevent_url: 'http://addevent.com/e/1' }, 'x', 'btn') === null);
  check('javascript: is refused',
    L.calendarLink({ ...WITH_LINK, addevent_url: 'javascript:alert(1)' }, 'x', 'btn') === null);
  check('a relative path is refused',
    L.calendarLink({ ...WITH_LINK, addevent_url: '/calendar' }, 'x', 'btn') === null);
  check('addEventUrl agrees', L.addEventUrl({ ...WITH_LINK, addevent_url: 'http://x.test/1' }) === '');
}

console.log('\nThe date no longer decides whether the button appears');
{
  // The old builder needed starts_at to make an .ics. A link does not.
  const a = L.calendarLink({ title: 'No date', addevent_url: WITH_LINK.addevent_url }, 'x', 'btn');
  check('a session with no start time still gets its link', Boolean(a), a);
}

/* ---------------------------------------------------------------------------
   The Live Sessions page itself: one subscribe link, no per-session buttons,
   and a placeholder that stands at the height of the loaded schedule.
   --------------------------------------------------------------------------- */

// Ten calls over four weeks, which is what the seed holds. Every one carries
// an addevent_url, so a renderer that still built per-session buttons would
// build ten of them and be caught below.
const SCHEDULE = [
  [1, 1, 'Open Business Surgery', '2026-10-26T16:00:00+00:00'],
  [2, 1, 'Bonus: Multi-LLM & Setting Your Harness', '2026-10-28T16:00:00+00:00'],
  [3, 1, 'Training Your Agent', '2026-10-30T16:00:00+00:00'],
  [4, 2, 'Your AI Operating System', '2026-11-02T17:00:00+00:00'],
  [5, 2, 'Expert Q&A', '2026-11-06T17:00:00+00:00'],
  [6, 3, 'Storytelling for GTM', '2026-11-09T17:00:00+00:00'],
  [7, 3, 'The AI Content Machine + Q&A', '2026-11-13T17:00:00+00:00'],
  [8, 4, 'Unfair AI Advantage', '2026-11-16T17:00:00+00:00'],
  [9, 4, 'Networking Session', '2026-11-18T17:00:00+00:00'],
  [10, 4, 'Q&A: Exited Founder', '2026-11-20T17:00:00+00:00'],
].map(([id, week_id, title, starts_at]) => ({
  id, week_id, title, starts_at,
  join_url: 'https://zoom.us/j/' + id,
  addevent_url: 'https://www.addevent.com/event/ab00000' + id,
  recording_url: null,
}));

// The real page markup, with portal-live.js and portal-sessions.js run
// against it, then the payload handed over the way portal-access.js hands it.
function renderPage() {
  // outside-only: window.eval runs with the window as its global, and the
  // page's own inline scripts (analytics, the theme, the page fade) stay off.
  const dom = new JSDOM(SESSIONS_HTML, {
    url: 'https://timerich.ai/portal/sessions.html',
    runScripts: 'outside-only',
    virtualConsole: new VirtualConsole(),
  });
  const w = dom.window;
  w.eval(LIVE);
  w.eval(SESSIONS_JS);
  const data = {
    ok: true,
    member: { first_name: 'Ella', role: 'buyer' },
    weeks: [0, 1, 2, 3, 4].map((id) => ({ id, title: 'Week ' + id, unlocked: id < 2, items: [] })),
    sessions: SCHEDULE,
    progress: { items: [], sessions: [] },
  };
  w.document.dispatchEvent(new w.CustomEvent('trportal:data', { detail: data }));
  return w.document;
}

console.log('\nLive Sessions: one subscribe link, at the top');
{
  const d = renderPage();
  const subs = [...d.querySelectorAll('a[href="' + SUBSCRIBE_URL + '"]')];
  check('exactly one link to the cohort calendar', subs.length === 1, subs.length);
  // Guarded: with no link at all the four checks below would throw, and a
  // suite that dies halfway reports far less than it knows.
  const sub = subs[0] || d.createElement('a');
  check('it reads "Add all sessions"', sub.textContent.trim() === 'Add all sessions',
    sub.textContent.trim());
  check('it opens in a new tab, safely',
    sub.getAttribute('target') === '_blank' &&
    sub.getAttribute('rel') === 'noopener noreferrer');
  check('and it is named for a screen reader',
    sub.getAttribute('aria-label') === 'Add all sessions to your calendar',
    sub.getAttribute('aria-label'));

  // Above the schedule, in the page header, not buried under the week cards.
  const header = d.querySelector('main header');
  check('it sits in the page header, above the schedule',
    subs.length === 1 && header !== null && header.contains(sub));

  // Written into the page, so it is pressable before any payload arrives.
  check('it is in the markup rather than built from the payload',
    SESSIONS_HTML.includes(SUBSCRIBE_URL));
  check('the old cal.ae link is gone from the renderer',
    !SESSIONS_JS.includes('cal.ae'), (SESSIONS_JS.match(/.{0,40}cal\.ae.{0,20}/) || [])[0]);
}

console.log('\nLive Sessions: no per-session calendar buttons');
{
  const d = renderPage();
  const rows = [...d.querySelectorAll('.trp-wkcards .trp-srow')];
  check('every session is on the page', rows.length === SCHEDULE.length, rows.length);

  // Each session's own Add Event page. Not one of them may be linked.
  const perSession = [...d.querySelectorAll('a[href*="addevent.com/event"]')];
  check('no row links to a session Add Event page', perSession.length === 0,
    perSession.map((a) => a.getAttribute('href')));
  check('and neither does the next session card',
    d.querySelector('.trp-next a[href*="addevent"]') === null);
  check('nothing on the page says "Add to calendar" any more',
    !/Add to calendar/.test(d.body.textContent),
    (d.body.textContent.match(/.{0,30}Add to calendar.{0,30}/) || [])[0]);
  check('and no row carries the icon-only calendar button class',
    d.querySelectorAll('.trp-cal').length === 0);

  // The renderer no longer reaches for the helper at all.
  check('portal-sessions.js does not call calendarLink',
    !/calendarLink/.test(SESSIONS_JS),
    (SESSIONS_JS.match(/.{0,40}calendarLink.{0,20}/) || [])[0]);

  // What a row before its day keeps: its date, its title and its tick.
  const locked = rows[0] || d.createElement('li');
  check('a row before its day still has its date, title and attended tick',
    Boolean(locked.querySelector('.trp-sdate')) &&
    locked.querySelector('.trp-sdate').textContent.length > 0 &&
    locked.querySelector('.trp-stitle').textContent.includes('Open Business Surgery') &&
    locked.querySelector('.trp-tick') !== null);
  check('with an empty action slot rather than a missing one',
    locked.querySelector('.trp-sact') !== null &&
    locked.querySelector('.trp-sact').children.length === 0);
}

console.log('\nLive Sessions: the space is reserved before the payload lands');
{
  // Measured in headless Chrome at 1440px and 375px: the schedule used to grow
  // by 864px and 1938px when the payload arrived. The placeholder is built
  // from the same classes as the loaded cards, which is what makes both of
  // those numbers zero. jsdom does no layout, so what is pinned here is the
  // shape the measurement depends on.
  const dom = new JSDOM(SESSIONS_HTML, { url: 'https://timerich.ai/portal/sessions.html' });
  const d = dom.window.document;
  const host = d.getElementById('trSessionList');
  const skel = host.querySelector('.trp-skel');

  check('the schedule box holds a placeholder, not one line of text',
    skel !== null && host.querySelector('.trp-lede') === null);
  if (skel === null) {
    // Everything below reads the placeholder, so say so once rather than
    // throwing and losing the blocks that follow.
    for (const name of ['it is hidden from assistive tech, which has the status line instead',
                        'it stands in for the next session card',
                        'and for four week cards, which is what the seeded schedule makes',
                        'holding one row per call, ten of them',
                        'built from the real card classes, so it measures the same']) {
      check(name, false, 'no placeholder on the page');
    }
  } else {
  check('it is hidden from assistive tech, which has the status line instead',
    skel.getAttribute('aria-hidden') === 'true' &&
    host.querySelector('[role="status"]') !== null &&
    host.querySelector('[role="status"]').textContent.includes('Loading your schedule'));

  check('it stands in for the next session card',
    skel.querySelector('.trp-next') !== null);
  check('and for four week cards, which is what the seeded schedule makes',
    skel.querySelectorAll('.trp-wkcard').length === 4,
    skel.querySelectorAll('.trp-wkcard').length);
  check('holding one row per call, ten of them',
    skel.querySelectorAll('.trp-srow').length === 10,
    skel.querySelectorAll('.trp-srow').length);
  check('built from the real card classes, so it measures the same',
    skel.querySelector('.glass-card.trp-next') !== null &&
    skel.querySelector('ul.trp-wkcards') !== null &&
    skel.querySelector('ul.trp-srows') !== null);
  }

  // The one part of the placeholder with no counterpart in the loaded page.
  // Left in flow it would cost its own height the moment it went.
  const css = readFileSync(new URL('../../portal/portal-tailwind-src.css', import.meta.url), 'utf8');
  check('the status line is taken out of flow, so losing it moves nothing',
    /\.trp-skel-say \{[^}]*position: absolute/.test(css),
    (css.match(/\.trp-skel-say \{[\s\S]*?\}/) || [])[0]);
  check('an empty bar takes the line box it sits in rather than a fixed height',
    /\.trp-skel \.trp-bar:empty \{ height: 1\.35em; \}/.test(css));
  check('and the built stylesheet carries it, so the source was rebuilt',
    readFileSync(new URL('../../portal/portal.css', import.meta.url), 'utf8')
      .includes('.trp-skel .trp-bar:empty{height:1.35em}'));

  // The renderer clears the box, so the placeholder is replaced rather than
  // pushed down by the real schedule.
  check('the renderer clears the box before it fills it',
    /L\.clear\(listEl\)/.test(SESSIONS_JS));
  const after = renderPage();
  check('once the payload lands the placeholder is gone',
    after.querySelector('.trp-skel') === null);
}


if (fail) {
  console.error(`\n${fail} calendar test(s) failed.`);
  process.exit(1);
}
console.log(`\n${pass} calendar test(s) passed.`);
