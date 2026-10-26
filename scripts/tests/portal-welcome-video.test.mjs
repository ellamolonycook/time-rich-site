// Ella's welcome video on the Curriculum.
//
// Start here (week 0) carries a `video` row and a calendar `link` row. Both
// used to sit in the welcome box -- the video as a small side card with an
// Open button that sent the member out to YouTube, the calendar as a second
// card beside the letter. Now the welcome box holds only Ella's letter and
// the Time Rich Pep Talk, and the two of them have a band of their own
// directly under it: the video wide on the left, a stripped-back calendar
// card on the right.
//
// What this suite pins:
//   - the band is its own section, after the welcome box, and the welcome
//     box holds neither the player nor a card;
//   - the src is rebuilt from a pattern-checked id by the portal's own
//     embedSrc, so the stored URL never reaches an iframe;
//   - the iframe is lazy and carries the row's title, and the heading above
//     it is that title;
//   - nothing under the video: no duration, no body line;
//   - the calendar card is its title and its button and nothing else, even
//     though the row has a body;
//   - a video URL embedSrc refuses draws nothing at all -- no player, no
//     button, no link out, anywhere on the page;
//   - the kind and the sort still decide which row this is.
//
// The page is driven the way portal-access.js drives it: the real
// portal-live.js and the real club/portal-access.js, then the payload handed
// over as a trportal:data event.
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const LIVE = read('club/portal-live.js');
const ACCESS = read('club/portal-access.js');
const HTML = read('club/curriculum.html');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

// Ella publishes on Vimeo.
const WATCH_URL = 'https://vimeo.com/987654321';
const EMBED_SRC = 'https://player.vimeo.com/video/987654321';
const CALENDAR_URL = 'https://www.addevent.com/calendar/z0j4nlqbgt6b';

// Three paragraphs, because the renderer lifts the first out as the lead
// line and the closing question out as the ask, and keeps the rest in the
// drop-down.
const LETTER_BODY = [
  "You're not here just to learn AI. You're here for an outcome.",
  'The middle of the letter, which stays in the Pep Talk.',
  'How serious are you about becoming Time Rich?',
].join('\n\n');

const LETTER = { id: 10, kind: 'text', title: 'Welcome to the Superhuman Accelerator', body: LETTER_BODY, sort: 10 };
const VIDEO = { id: 15, kind: 'video', title: 'Welcome Video', body: '3 minutes.', url: WATCH_URL, sort: 15 };
const CALENDAR = { id: 20, kind: 'link', title: 'Add every session to your calendar', body: 'All 9 live sessions at 12pm ET.', url: CALENDAR_URL, sort: 20 };
// One setup step, so Week 1's panel has something in it either way.
const STEP = { id: 110, kind: 'link', title: 'Join the Club Slack', body: 'Say hello.', url: 'https://join.slack.com/t/x/shared_invite/y', sort: 110 };

function payload(prepItems, doneIds) {
  return {
    ok: true,
    member: { first_name: 'Ella', role: 'buyer', setup: { calendar: false, notion: false } },
    weeks: [0, 1, 2, 3, 4].map((id) => ({
      id,
      title: id === 0 ? 'Week 1: Start here' : 'Week ' + id,
      unlocked: id === 0,
      release_at: '2026-10-26T04:00:00.000Z',
      items: id === 0 ? prepItems : [],
    })),
    sessions: [],
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

function open(prepItems, doneIds) {
  const data = payload(prepItems, doneIds);
  const dom = new JSDOM(HTML, {
    url: 'https://timerich.ai/club/curriculum.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),   // the shell's own scripts are not under test here
    beforeParse(window) {
      window.tailwind = {};
      window.gtag = () => {};
      window.TR_PORTAL_CONFIG = { sessionUrl: 'https://worker.test/portal-session' };
      window.localStorage.setItem('tr_portal_session', JSON.stringify({ token: 'tok-ABCDE', expires_at: new Date(Date.now() + 30 * 864e5).toISOString() }));
      window.fetch = () => Promise.resolve(new globalThis.Response(JSON.stringify(data), { status: 200 }));
      freeze(window, '2026-10-20T12:00:00.000Z');
      window.eval(LIVE);     // the page's inline renderer needs TRLive at parse time
    },
  });
  const w = dom.window;
  w.eval(ACCESS);            // and TRPortal.embedSrc / videoFrame at render time
  w.TRLive.setProgress(data);
  w.TR_PORTAL_DATA = data;
  w.document.dispatchEvent(new w.CustomEvent('trportal:data', { detail: data }));
  const doc = w.document;
  const live = doc.querySelector('[data-curriculum-live]');
  const hello = live && live.querySelector('.trp-cw-welcome');
  const band = live && live.querySelector('.trp-cw-intro');
  return {
    dom, w, doc, live, hello, band,
    // Every player and every outbound link on the whole page, so a stray
    // one cannot hide in a corner this suite does not look at.
    frames: () => [...live.querySelectorAll('iframe')],
    links: () => [...live.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')),
    cards: () => [...(band ? band.querySelectorAll('.trp-cw-mini') : [])],
    steps: () => [...live.querySelectorAll('.trp-cw-task-title')].map((n) => n.textContent),
    // "x of y done" on the week panel, and on each setup step.
    panelCount: () => { const n = live.querySelector('.trp-cw-count'); return n ? n.textContent : null; },
    stepCounts: () => [...live.querySelectorAll('.trp-cw-step-count')].map((n) => n.textContent),
    barCount: () => { const n = doc.querySelector('[data-curriculum-bar] .trp-headbar-count'); return n ? n.textContent : null; },
    // The tick beside a setup-step row, by the row's title.
    tickFor: (title) => {
      const row = [...live.querySelectorAll('.trp-cw-task')]
        .find((r) => r.querySelector('.trp-cw-task-title') && r.querySelector('.trp-cw-task-title').textContent.startsWith(title));
      return row ? row.querySelector('.trp-check-box') : null;
    },
  };
}

/* ---------------------------------------------------------------------------
   The portal API the page reuses.
   --------------------------------------------------------------------------- */

console.log('\nThe portal exposes the embed builder, and it still checks before it trusts');
{
  const p = open([LETTER, VIDEO, CALENDAR]);
  const api = p.w.TRPortal;
  check('embedSrc is reachable from the page', typeof api.embedSrc === 'function', typeof api.embedSrc);
  check('videoFrame is reachable from the page', typeof api.videoFrame === 'function', typeof api.videoFrame);

  // A raw string, which is what an item carries, goes through the same
  // https-only check the cards get.
  check('a Vimeo link becomes a player embed', api.embedSrc(WATCH_URL) === EMBED_SRC, api.embedSrc(WATCH_URL));
  check('a /video/ Vimeo link becomes the same embed',
    api.embedSrc('https://vimeo.com/video/987654321') === EMBED_SRC,
    api.embedSrc('https://vimeo.com/video/987654321'));
  check('a YouTube link is still accepted',
    api.embedSrc('https://youtu.be/dkrEKSSWXys') === 'https://www.youtube-nocookie.com/embed/dkrEKSSWXys');
  check('a Loom share link is still accepted',
    api.embedSrc('https://www.loom.com/share/' + 'a'.repeat(32)) === 'https://www.loom.com/embed/' + 'a'.repeat(32));

  check('http is refused', api.embedSrc('http://vimeo.com/987654321') === null);
  check('javascript: is refused', api.embedSrc('javascript:alert(1)') === null);
  check('an unknown host is refused', api.embedSrc('https://videos.example.com/ella.mp4') === null);
  check('a Vimeo id of the wrong shape is refused', api.embedSrc('https://vimeo.com/not-an-id') === null);
  check('an empty string is refused', api.embedSrc('') === null);
  check('nothing at all is refused', api.embedSrc(null) === null && api.embedSrc(undefined) === null);
  p.w.close();
}

/* ---------------------------------------------------------------------------
   Where the video and the calendar now live.
   --------------------------------------------------------------------------- */

console.log('\nThe video and the calendar have a band of their own, under the welcome');
{
  const p = open([LETTER, VIDEO, CALENDAR]);
  check('the welcome is drawn', Boolean(p.hello));
  check('the band is drawn', Boolean(p.band));
  check('the band is not inside the welcome', Boolean(p.band) && !p.hello.contains(p.band));
  check('it comes directly after the welcome box',
    p.hello.nextElementSibling === p.band, p.hello.nextElementSibling && p.hello.nextElementSibling.className);

  // The welcome is Ella's letter and the Pep Talk, and nothing else.
  check('the welcome holds no player', p.hello.querySelector('iframe') === null);
  check('the welcome holds no card',
    p.hello.querySelector('.trp-cw-mini') === null && p.hello.querySelector('.trp-cw-side') === null);
  check('and no link of any kind',
    p.hello.querySelector('a[href]') === null, p.hello.innerHTML.slice(0, 80));

  p.w.close();
}

console.log('\nThe player');
{
  const p = open([LETTER, VIDEO, CALENDAR]);
  const frames = p.frames();
  check('exactly one player on the page', frames.length === 1, frames.length);
  const frame = frames[0];
  check('and it is in the band', p.band.contains(frame));

  check('its src is the rebuilt embed, not the stored URL',
    frame.getAttribute('src') === EMBED_SRC, frame.getAttribute('src'));
  check('the stored URL appears nowhere on the page',
    !p.live.innerHTML.includes('vimeo.com/987654321'),
    (p.live.innerHTML.match(/.{0,40}vimeo\.com\/987654321.{0,20}/) || [])[0]);

  check('it loads lazily', frame.getAttribute('loading') === 'lazy', frame.getAttribute('loading'));
  check('it is named for a screen reader with the row title',
    frame.getAttribute('title') === 'Welcome Video', frame.getAttribute('title'));
  check('and it is allowed to go full screen', frame.hasAttribute('allowfullscreen'));

  const box = frame.parentNode;
  check('the player sits in the rounded 16:9 box',
    box.classList.contains('trp-video') && box.classList.contains('trp-cw-video'), box.className);

  // The heading is the row's title, and nothing else is drawn with it.
  const col = p.band.querySelector('.trp-cw-intro-vid');
  check('the heading above it is the row title',
    col.querySelector('.trp-cw-intro-title').textContent === 'Welcome Video',
    col.querySelector('.trp-cw-intro-title').textContent);
  check('the heading and the player are all there is',
    col.children.length === 2 && col.children[0].matches('.trp-cw-intro-title') && col.children[1].matches('.trp-cw-video'),
    [...col.children].map((n) => n.className));
  check('the duration is not drawn under it',
    !p.band.textContent.includes('3 minutes'), p.band.textContent);

  p.w.close();
}

console.log('\nThe calendar card, stripped back to its title and its button');
{
  const p = open([LETTER, VIDEO, CALENDAR]);
  const cards = p.cards();
  check('one card in the band', cards.length === 1, cards.length);
  const card = cards[0];
  check('it keeps its title',
    card.querySelector('.trp-cw-mini-title').textContent === 'Add every session to your calendar',
    card.querySelector('.trp-cw-mini-title').textContent);
  check('the body line is not drawn, though the row has one',
    !card.textContent.includes('All 9 live sessions'), card.textContent);
  check('and it is nowhere else on the page either',
    !p.live.textContent.includes('All 9 live sessions'),
    (p.live.textContent.match(/.{0,30}All 9 live sessions.{0,20}/) || [])[0]);

  const btn = card.querySelector('a');
  check('its button is the only other thing in the card',
    card.children.length === 2 && card.children[1] === btn, [...card.children].map((n) => n.tagName));
  check('saying what it does', btn.textContent === 'Add to my calendar', btn.textContent);
  check('pointing at the stored URL', btn.getAttribute('href') === CALENDAR_URL, btn.getAttribute('href'));
  check('named for a screen reader',
    (btn.getAttribute('aria-label') || '').startsWith('Add to my calendar: '), btn.getAttribute('aria-label'));

  // The card is drawn after the video in the document, which is what puts
  // it under the video on a phone and beside it on a desktop.
  check('the video comes before the card in the band',
    p.band.children[0].matches('.trp-cw-intro-vid') && p.band.children[1] === card,
    [...p.band.children].map((n) => n.className));

  p.w.close();
}

/* ---------------------------------------------------------------------------
   A video the portal will not embed.
   --------------------------------------------------------------------------- */

console.log('\nA video URL embedSrc refuses draws nothing at all');
{
  const BAD = { ...VIDEO, url: 'https://videos.example.com/ella-welcome.mp4' };
  const p = open([LETTER, BAD, CALENDAR]);
  check('no player is drawn', p.frames().length === 0, p.frames().length);
  check('no link to it anywhere on the page',
    !p.links().some((h) => { try { return new URL(h, 'https://timerich.ai/').hostname === 'videos.example.com'; } catch (e) { return false; } }), p.links());
  check('no Watch or Open button stands in for it',
    !/\bWatch\b/.test(p.live.textContent), (p.live.textContent.match(/.{0,30}Watch.{0,20}/) || [])[0]);
  check('its title is not drawn either',
    !p.live.textContent.includes('Welcome Video'), (p.live.textContent.match(/.{0,30}Welcome Video.{0,20}/) || [])[0]);

  // The band is still there, because the calendar still belongs in it.
  check('the calendar card is still drawn', p.cards().length === 1, p.cards().length);
  check('and there is no empty video column',
    p.band.querySelector('.trp-cw-intro-vid') === null);
  p.w.close();
}

console.log('\nWith nothing to put in it, the band is not drawn');
{
  const p = open([LETTER]);
  check('no band', p.band === null);
  check('the welcome is still drawn', Boolean(p.hello));
  p.w.close();
}

/* ---------------------------------------------------------------------------
   The kind and the sort still decide.
   --------------------------------------------------------------------------- */

console.log('\nThe kind and the sort still decide');
{
  // An embeddable URL on a `link` row is a card, not a player.
  const asLink = open([LETTER, { ...VIDEO, kind: 'link' }, CALENDAR]);
  check('an embeddable URL on a link row stays a card', asLink.frames().length === 0, asLink.frames().length);
  check('and is drawn as one of the band\'s cards', asLink.cards().length === 2, asLink.cards().length);
  asLink.w.close();

  // Sort 100 and up is a setup step in Week 1's panel, not a pinned row.
  const asStep = open([LETTER, { ...VIDEO, sort: 150 }, CALENDAR, STEP]);
  check('a video at sort 150 does not play in the band', asStep.frames().length === 0, asStep.frames().length);
  check('it is a setup step instead', asStep.steps().includes('Welcome Video'), asStep.steps());
  asStep.w.close();

  // Two embeddable videos: the first plays, and the second is dropped
  // rather than linked out, because nothing sends the member off the page.
  const two = open([LETTER, VIDEO, { ...VIDEO, id: 16, title: 'A second video', url: 'https://youtu.be/dkrEKSSWXys', sort: 16 }, CALENDAR]);
  check('only the first embeddable video plays', two.frames().length === 1, two.frames().length);
  check('the second is not drawn as a link',
    !two.links().some((h) => /youtu/.test(h)) && !two.live.textContent.includes('A second video'), two.links());
  two.w.close();
}

/* ---------------------------------------------------------------------------
   A video is not progress.
   --------------------------------------------------------------------------- */

console.log('\nA video row counts toward nothing, so progress can reach 100%');
{
  const p = open([LETTER, VIDEO, CALENDAR]);
  const L = p.w.TRLive;

  check('TRLive says a video is not trackable', L.isTrackable(VIDEO) === false);
  check('but an ordinary row is', L.isTrackable(CALENDAR) === true && L.isTrackable(LETTER) === true);
  check('and a row with no id still is not', L.isTrackable({ kind: 'link', title: 'x' }) === false);

  // Two rows carry the count, not three: the letter and the calendar.
  const you = L.userProgress(p.w.TR_PORTAL_DATA);
  check('the video is left out of the total', you.total === 2, you);
  p.w.close();

  // Even a video carrying an old tick -- one written before this rule --
  // moves neither number.
  const stale = open([LETTER, VIDEO, CALENDAR], [15]);
  const was = stale.w.TRLive.userProgress(stale.w.TR_PORTAL_DATA);
  check('a video already marked done still counts for nothing',
    was.done === 0 && was.total === 2 && was.percent === 0, was);
  stale.w.close();

  // Everything the member can actually tick, ticked: the bar reads full.
  const full = open([LETTER, VIDEO, CALENDAR], [10, 20]);
  const done = full.w.TRLive.userProgress(full.w.TR_PORTAL_DATA);
  check('with both ticked the member is at 100%',
    done.done === 2 && done.total === 2 && done.percent === 100, done);
  check('and the header bar says so', full.barCount() === '2 of 2 done', full.barCount());
  full.w.close();
}

console.log('\nA video that is a setup step is not counted or ticked either');
{
  // Sort 150 puts it in Week 1's step 1, beside the Slack row.
  const p = open([LETTER, { ...VIDEO, sort: 150 }, CALENDAR, STEP]);
  check('the row is still drawn', p.steps().includes('Welcome Video'), p.steps());
  check('the step counts only the row that can be ticked',
    p.stepCounts().every((t) => t === '0 of 1 done'), p.stepCounts());
  check('and so does the panel', p.panelCount() === '0 of 1 done', p.panelCount());
  check('the video row has no tick to press',
    p.tickFor('Welcome Video') !== null && p.tickFor('Welcome Video').tagName !== 'BUTTON',
    p.tickFor('Welcome Video') && p.tickFor('Welcome Video').tagName);
  check('while the Slack row still has one',
    p.tickFor('Join the Club Slack').tagName === 'BUTTON', p.tickFor('Join the Club Slack').tagName);
  p.w.close();
}

/* ---------------------------------------------------------------------------
   What this was not allowed to disturb.
   --------------------------------------------------------------------------- */

console.log('\nThe letter and the Pep Talk are untouched');
{
  const p = open([LETTER, VIDEO, CALENDAR]);
  const toggle = p.hello.querySelector('.trp-cw-pep-toggle');
  check('the Pep Talk toggle is still there', Boolean(toggle) && toggle.textContent.includes('Time Rich Pep Talk'), toggle && toggle.textContent);
  check('still open by default', toggle.getAttribute('aria-expanded') === 'true', toggle.getAttribute('aria-expanded'));
  check('with the photo and the rest of the letter',
    Boolean(p.hello.querySelector('.trp-cw-pep-body .trp-cw-letter-photo')) &&
    p.hello.querySelector('.trp-cw-pep-body').textContent.includes('The middle of the letter'));
  check('the title is still the letter\'s title',
    p.hello.querySelector('.trp-cw-h2').textContent === 'Welcome to the Superhuman Accelerator');
  check('the lead line and the ask are still lifted out',
    p.hello.querySelector('.trp-cw-lead').textContent.startsWith("You're not here just to learn AI") &&
    p.hello.querySelector('.trp-cw-ask').textContent === 'How serious are you about becoming Time Rich?');
  /* The WhatsApp card goes in between now: announcements and session links
     land there, so it sits above the four weeks rather than below them. */
  check('the WhatsApp card follows the band',
    p.band.nextElementSibling && p.band.nextElementSibling.id === 'cw-whatsapp',
    p.band.nextElementSibling && p.band.nextElementSibling.className);
  check('and the week tabs follow that',
    p.band.nextElementSibling.nextElementSibling.className === 'trp-cw-weeks',
    p.band.nextElementSibling.nextElementSibling.className);
  p.w.close();
}

console.log('\nThe loading placeholder holds the band\'s height');
{
  // The skeleton is there so the footer does not jump when the payload
  // lands, and the player is the tallest thing above the week tabs.
  const p = open([LETTER, VIDEO, CALENDAR]);
  const skel = p.doc.querySelector('[data-curriculum-static] .trp-cw-intro');
  check('the placeholder has the band', Boolean(skel));
  check('with the video box in it', Boolean(skel && skel.querySelector('.trp-cw-intro-vid .trp-cw-video .trp-bar')));
  check('and the small calendar card', Boolean(skel && skel.querySelector('.trp-cw-mini .trp-cw-mini-title')));
  check('the placeholder welcome no longer holds either',
    p.doc.querySelector('[data-curriculum-static] .trp-cw-welcome .trp-cw-video') === null &&
    p.doc.querySelector('[data-curriculum-static] .trp-cw-welcome .trp-cw-side') === null);
  p.w.close();
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
