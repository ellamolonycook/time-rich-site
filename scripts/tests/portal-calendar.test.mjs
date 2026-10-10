// Add to Calendar tests.
//
// The portal used to build an .ics in the browser and offer a
// Google/Outlook/Apple pop-up. There is now one link per session, to the
// Add Event page held in portal_sessions.addevent_url. A session with no
// addevent_url has no button at all.
//
// These load portal-live.js the way a page does and drive the helper the
// three call sites use.
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';

const LIVE = readFileSync(new URL('../../portal/portal-live.js', import.meta.url), 'utf8');

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

if (fail) {
  console.error(`\n${fail} calendar test(s) failed.`);
  process.exit(1);
}
console.log(`\n${pass} calendar test(s) passed.`);
