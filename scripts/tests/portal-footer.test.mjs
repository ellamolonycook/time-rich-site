// The portal footer: one quiet line, and no stranded separator when it wraps.
//
// The line reads "© 2026 Time Rich · Privacy · Terms · WhatsApp community ·
// Need help? emc@timerich.ai". It is a wrapping flex row, so on a narrow
// screen it breaks over two lines -- and wherever the break lands, the "·"
// after the last item on line one would be carried down to the head of line
// two, which read as "· Need help? ...". CSS cannot ask whether an element
// starts a wrapped line, so the rule takes the whole set out below the width
// at which the line fits in one row, and opens the gap up instead.
//
// jsdom does no layout, so this suite cannot measure the wrap. What it can
// pin, and what actually regresses, is the shape the rule depends on: every
// separator is a .trp-foot-sep and there are no others, the stylesheet hides
// that class by default and brings it back above the breakpoint, and the
// conditional WhatsApp separator still answers to [hidden].
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

// Every page inside the gate. The sign-in page has no footer.
const PAGES = [
  'portal/dashboard.html',
  'portal/curriculum.html',
  'portal/sessions.html',
  'portal/resources.html',
  'portal/prompts.html',
  'portal/members.html',
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

  // Four separators: after the copyright, after Privacy, after Terms, and the
  // conditional one before the WhatsApp link.
  const seps = [...row.querySelectorAll('.trp-foot-sep')];
  check('four separators, every one of them named', seps.length === 4, seps.length);

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

  // The lockup moved to the header; nothing but the line is down here.
  check('and no sponsor lockup under it',
    footer.querySelectorAll('.trp-powered').length === 0);

  const text = row.textContent.replace(/\s+/g, ' ').trim();
  check('the line still reads as the brief sets it',
    /^© 2026 Time Rich · Privacy · Terms · WhatsApp community · Need help\? emc@timerich\.ai$/.test(text),
    text);
}

/* ---- the rule ----------------------------------------------------------- */

console.log('\nthe rule that keeps a separator off the head of a wrapped line');
{
  const src = read('portal/portal-tailwind-src.css');
  const built = read('portal/portal.css');

  check('the separators are hidden by default, which is the narrow case',
    /\.trp-foot-sep \{\s*display: none;\s*\}/.test(src));

  // The breakpoint has to be above the width at which the line still wraps.
  // Measured in a browser at 540px with every item showing; 576 leaves room.
  const m = src.match(/@media \(min-width: (\d+)px\) \{\s*\.trp-foot \{[^}]*\}\s*\.trp-foot-sep \{\s*display: inline;/);
  check('and come back at a breakpoint above the width the line wraps at',
    m !== null && Number(m[1]) >= 540, m && m[1]);

  check('the gap opens up below the breakpoint, so the items still read apart',
    /\.trp-foot \{ column-gap: 14px; row-gap: 4px; \}/.test(src));

  check('the built CSS carries the rule, so the source was rebuilt',
    /\.trp-foot-sep\{display:none\}/.test(built) && /\.trp-foot-sep\{display:inline\}/.test(built));

  // [hidden] has to keep beating the media query, or the conditional
  // separator would reappear on a wide screen with no link beside it.
  check('[hidden] still wins over the breakpoint, so the conditional dot stays away',
    /\[hidden\] \{ display: none !important; \}/.test(read('portal/portal-content.css')));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
