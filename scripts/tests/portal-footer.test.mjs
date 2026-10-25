// The portal footer: one quiet line, and no stranded separator when it wraps.
//
// The line reads "© 2026 Time Rich · Privacy · Terms · WhatsApp community ·
// Need help? emc@timerichclub.com · Powered by Stanley". It is a wrapping
// flex row, so on a narrow screen it breaks over two lines -- and wherever
// the break lands, the "·" after the last item on line one would be carried
// down to the head of line two, which read as "· Need help? ...". CSS cannot
// ask whether an element
// starts a wrapped line, so the rule takes the whole set out below the width
// at which the line fits in one row, and opens the gap up instead.
//
// jsdom does no layout, so this suite cannot measure the wrap. What it can
// pin, and what actually regresses, is the shape the rule depends on: every
// separator is a .trp-foot-sep and there are no others, the stylesheet hides
// that class by default and brings it back above the breakpoint, and the
// conditional WhatsApp separator still answers to [hidden].
import { JSDOM } from 'jsdom';
import { readFileSync, readdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

// Every page inside the gate. The sign-in page has no footer.
const PAGES = [
  'club/dashboard.html',
  'club/curriculum.html',
  'club/sessions.html',
  'club/resources.html',
  'club/prompts.html',
  'club/members.html',
];

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

/* ---- the markup --------------------------------------------------------- */

for (const path of PAGES) {
  console.log('\n' + path + ' — the footer line');
  const document = new JSDOM(read(path)).window.document;
  const footer = document.querySelector('footer');
  const row = footer && footer.querySelector('p');

  check('there is one footer, holding one line', footer !== null &&
    footer.querySelectorAll('p').length === 1,
    footer && footer.querySelectorAll('p').length);

  check('the line is the named wrapping row',
    row !== null && /\btrp-foot\b/.test(row.className) && /\bflex-wrap\b/.test(row.className),
    row && row.className);

  // Five separators: after the copyright, after Privacy, after Terms, the
  // conditional one before the WhatsApp link, and the one before the Stanley
  // credit that came back down from the header.
  const seps = [...row.querySelectorAll('.trp-foot-sep')];
  check('five separators, every one of them named', seps.length === 5, seps.length);

  check('and every one is the middle dot, hidden from assistive tech',
    seps.every((s) => s.textContent.trim() === '·' &&
                      s.getAttribute('aria-hidden') === 'true'),
    seps.map((s) => s.textContent.trim() + '/' + s.getAttribute('aria-hidden')));

  // The thing that actually regresses: someone adds a bare <span>·</span>
  // and the rule no longer reaches it.
  const strays = [...row.children].filter(
    (el) => el.textContent.trim() === '·' && !/\btrp-foot-sep\b/.test(el.className || ''));
  check('no separator is left outside the class', strays.length === 0,
    strays.map((el) => el.outerHTML));

  // The WhatsApp link and its own separator are a pair: both conditional,
  // both hidden until the week 0 link item supplies the href.
  const community = [...row.querySelectorAll('[data-portal-community]')];
  check('the WhatsApp link and its separator are both conditional, both hidden',
    community.length === 2 && community.every((el) => el.hasAttribute('hidden')),
    community.map((el) => el.tagName + '/' + el.hasAttribute('hidden')));

  check('one of that pair is the separator, the other is the link',
    community.filter((el) => /\btrp-foot-sep\b/.test(el.className || '')).length === 1 &&
    community.filter((el) => el.tagName === 'A').length === 1);

  // The sponsor credit came back down from the header, where it had been
  // since the duplicate was removed. It is on the line itself rather than in
  // a band under it, so the footer is still one wrapping row, and it is the
  // last item on it with its own separator in front.
  //
  // It is a pair now: Stanley, the presenting sponsor, and Wispr Flow, the
  // voice partner, inside one .trp-credits group so "Powered by" is said once
  // over both of them.
  const groups = [...footer.querySelectorAll('.trp-credits')];
  check('the sponsor credit is on the line, exactly once',
    groups.length === 1, groups.length);
  check('and it is inside the row rather than under it',
    groups.length === 1 && row.contains(groups[0]));
  check('it is the last item on the line',
    groups.length === 1 && row.lastElementChild === groups[0],
    row.lastElementChild && row.lastElementChild.className);

  const credits = groups.length ? [...groups[0].querySelectorAll('a')] : [];
  check('it holds two links, Stanley then Wispr Flow',
    credits.length === 2 &&
    credits[0].getAttribute('href') === 'https://x.getstanley.ai/r/mz4y9g' &&
    credits[1].getAttribute('href') === 'https://wisprflow.ai/info/redeem-promo?code=TIMERICH6&months=6',
    credits.map((a) => a.getAttribute('href')));
  check('both open in a new tab and are marked sponsored',
    credits.length === 2 && credits.every((a) => a.getAttribute('target') === '_blank' &&
      /\bnoopener\b/.test(a.getAttribute('rel') || '') &&
      /\bsponsored\b/.test(a.getAttribute('rel') || '')),
    credits.map((a) => a.getAttribute('rel')));
  check('"Powered by" is said once, over the pair rather than inside a link',
    groups.length === 1 &&
    groups[0].querySelectorAll('.trp-powered-label').length === 1 &&
    credits.every((a) => a.querySelector('.trp-powered-label') === null));

  // Wispr's mark is a near-black tile, not a wordmark, so on its own it reads
  // as a stray black square. The words beside it are what name it. Stanley's
  // own file carries its name already.
  check('the Wispr Flow mark is named in words beside it',
    credits.length === 2 && credits[1].textContent.replace(/\s+/g, ' ').trim() === 'Wispr Flow',
    credits.length === 2 && credits[1].textContent.trim());
  check('and its image is decorative, so the name is not read out twice',
    credits.length === 2 && credits[1].querySelector('img') !== null &&
    credits[1].querySelector('img').getAttribute('alt') === '',
    credits.length === 2 && credits[1].querySelector('img') &&
    credits[1].querySelector('img').getAttribute('alt'));

  // The script that used to swap the Stanley artwork for a cropped, greyed
  // copy is gone. If it ever comes back, so does the misaligned logo.
  check('nothing on the page swaps the artwork at runtime',
    !read('club/portal-chrome.js').includes('stanley-clean') &&
    !read('club/portal-content.css').includes('stanley-clean'));

  const text = row.textContent.replace(/\s+/g, ' ').trim();
  check('the line still reads as the brief sets it, with the credit last',
    /^© 2026 Time Rich · Privacy · Terms · WhatsApp community · Need help\? emc@timerichclub\.com · Powered by · Wispr Flow$/.test(text),
    text);
}

/* ---- the rule ----------------------------------------------------------- */

console.log('\nthe rule that keeps a separator off the head of a wrapped line');
{
  const src = read('club/portal-tailwind-src.css');
  const built = read('club/portal.css');

  check('the separators are hidden by default, which is the narrow case',
    /\.trp-foot-sep \{\s*display: none;\s*\}/.test(src));

  // The breakpoint has to be at or above the width the line stops wrapping
  // at. Measured in headless Chrome with every item showing, including the
  // Stanley credit that came back down from the header: the row is one line
  // from 900px and two or three below it. It was 576 when the line ended at
  // the support address.
  const m = src.match(/@media \(min-width: (\d+)px\) \{\s*\.trp-foot \{[^}]*\}\s*\.trp-foot-sep \{\s*display: inline;/);
  check('and come back at a breakpoint above the width the line wraps at',
    m !== null && Number(m[1]) >= 900, m && m[1]);

  check('the gap opens up below the breakpoint, so the items still read apart',
    /\.trp-foot \{ column-gap: 14px; row-gap: 4px; \}/.test(src));

  check('the built CSS carries the rule, so the source was rebuilt',
    /\.trp-foot-sep\{display:none\}/.test(built) && /\.trp-foot-sep\{display:inline\}/.test(built));

  // [hidden] has to keep beating the media query, or the conditional
  // separator would reappear on a wide screen with no link beside it.
  check('[hidden] still wins over the breakpoint, so the conditional dot stays away',
    /\[hidden\] \{ display: none !important; \}/.test(read('club/portal-content.css')));
}

/* ---- the support address ------------------------------------------------ */

// Support moved to emc@timerichclub.com. The old address is not forwarded, so
// a support mailto left behind anywhere in the portal is a member writing into
// a mailbox nobody reads. This sweeps the whole folder rather than the five
// footers, because the address is also on the sign-in page, in the dashboard
// help link, in the bad-code message in portal-access.js and twice in the
// Resources questions.
//
// One address is deliberately not support. The Club page's "Want to partner on
// an event?" line goes to Ella's own emc@timerich.ai, which is what she asked
// for: an event partnership is a note to her, not a support request. So the
// sweep no longer bans the old address outright. It pins it to that one link
// and fails on a second one anywhere, which is the thing that actually goes
// wrong. emc@timerichclub.com does not contain emc@timerich.ai as a substring,
// so the two counts never overlap.
const PARTNER_FILE = 'home.html';
const PARTNER_LINK = 'mailto:emc@timerich.ai';
const PARTNER_TEXT = 'Want to partner on an event?';
console.log('\nthe support address, everywhere in club/');
{
  const dir = new URL('../../club/', import.meta.url);
  // club/index.html is the public Apply page at /club, not a portal page, and
  // it has its own contact copy.
  const files = readdirSync(dir).filter((f) => /\.(html|js|css)$/.test(f) && f !== 'index.html');

  check('there are portal files to sweep', files.length > 10, files.length);

  const count = (body, needle) => body.split(needle).length - 1;

  const stale = files
    .map((f) => [f, readFileSync(new URL(f, dir), 'utf8')])
    .filter(([f, body]) => body.includes('emc@timerich.ai') && f !== PARTNER_FILE);
  check('no file but the Club page carries emc@timerich.ai', stale.length === 0,
    stale.map(([f]) => f));

  // And on the Club page it is the partnership link and only that: one
  // occurrence, inside one mailto. A support line that crept back in would
  // show up as a second occurrence.
  const club = readFileSync(new URL(PARTNER_FILE, dir), 'utf8');
  check('on the Club page it is the event-partnership link, exactly once',
    count(club, 'emc@timerich.ai') === 1 && count(club, PARTNER_LINK) === 1,
    [count(club, 'emc@timerich.ai'), count(club, PARTNER_LINK)]);

  // Walk the rendered page too, so the address is still the partnership
  // question and has not been reused as the page's help link.
  {
    const d = new JSDOM(club).window.document;
    const partner = [...d.querySelectorAll('a[href^="mailto:"]')]
      .filter((a) => a.getAttribute('href') === PARTNER_LINK);
    const label = partner.length === 1
      ? partner[0].textContent.split(/\s+/).join(' ').trim() : '';
    check('and it reads as the partnership question, not as support',
      label === PARTNER_TEXT, label);
  }

  // And the new one is actually there, or the sweep above would pass on a
  // portal with no support address at all.
  const carrying = files
    .map((f) => [f, readFileSync(new URL(f, dir), 'utf8')])
    .filter(([, body]) => body.includes('emc@timerichclub.com'));
  check('every page inside the gate carries the new one',
    PAGES.every((p) => carrying.some(([f]) => p.endsWith(f))),
    carrying.map(([f]) => f));
  check('so does the sign-in page and the gate script itself',
    carrying.some(([f]) => f === 'signin.html') &&
    carrying.some(([f]) => f === 'portal-access.js'),
    carrying.map(([f]) => f));

  // Every mailto on a page goes to the new address, not just the text beside
  // it: the two drift apart the moment one is edited and the other is not.
  for (const path of PAGES.concat(['club/signin.html'])) {
    const d = new JSDOM(read(path)).window.document;
    const mailtos = [...d.querySelectorAll('a[href^="mailto:"]')]
      .map((a) => a.getAttribute('href').replace(/^mailto:/, '').split('?')[0]);
    check(path + ': every mailto goes to the new address',
      mailtos.length > 0 && mailtos.every((m) => m === 'emc@timerichclub.com'),
      mailtos);
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
