// The "Powered by Stanley" lockup, read out of the pages in jsdom.
//
// Stanley is the anchor sponsor, so the thing worth pinning is that the
// lockup is actually on every page that owes them one, and that each one is a
// working credit: the referral link, the attributes that keep it safe and
// countable, an alt of "Stanley" so the credit survives with images off, and
// width and height so the logo does not shove the page about as it loads.
//
// Two files, not one. The wordmark is black and vanishes on the portal's dark
// theme, so the portal carries a reversed copy beside the normal one and the
// theme picks. /accelerator has no dark theme and carries only the normal one.
//
// Inside the portal the credit appears ONCE per page, on the footer line. It
// used to appear twice -- once in the header from 1280px up, and again in
// every footer -- so the footer copy was dropped and the header one kept.
// The redesign then cleared the masthead down to the wordmark, the menu and
// the member's own controls, which sent the single remaining credit back to
// the footer. It is shown at every width, wording and all: the quiet line
// has room for it in a way the masthead did not.
import { JSDOM } from 'jsdom';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

const HREF = 'https://x.getstanley.ai/r/mz4y9g';
const LIGHT = 'brand/partners/stanley-logo.png';
const DARK = 'brand/partners/stanley-logo-dark.png';

// Every page that owes Stanley a credit, and where it has to appear.
//   selector — what the lockup is called on that page
//   spots    — how many of them the page carries
//   themed   — true where the page has a dark theme and so needs both files
const PAGES = [
  { path: 'accelerator/index.html', selector: '.powered', spots: 2, themed: false },
  { path: 'club/signin.html', selector: '.trp-powered', spots: 1, themed: true },
  { path: 'club/dashboard.html', selector: '.trp-powered', spots: 1, themed: true },
  { path: 'club/curriculum.html', selector: '.trp-powered', spots: 1, themed: true },
  { path: 'club/sessions.html', selector: '.trp-powered', spots: 1, themed: true },
  { path: 'club/prompts.html', selector: '.trp-powered', spots: 1, themed: true },
  { path: 'club/resources.html', selector: '.trp-powered', spots: 1, themed: true },
  { path: 'club/members.html', selector: '.trp-powered', spots: 1, themed: true },
];

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

const doc = (path) => new JSDOM(read(path)).window.document;

/* ---- the lockup is on every page, and is a working credit -------------- */

for (const page of PAGES) {
  console.log('\n' + page.path + ' — the Stanley lockup');
  const document = doc(page.path);
  const lockups = [...document.querySelectorAll(page.selector)];

  check('the lockup is on the page, ' + page.spots + ' time(s)',
    lockups.length === page.spots, lockups.length);

  check('every one of them is the link, pointed at the referral URL',
    lockups.length > 0 &&
    lockups.every((a) => a.tagName === 'A' && a.getAttribute('href') === HREF),
    lockups.map((a) => a.tagName + ' ' + a.getAttribute('href')));

  check('each opens in a new tab without handing over the page',
    lockups.length === page.spots && lockups.every((a) => a.getAttribute('target') === '_blank' &&
      /\bnoopener\b/.test(a.getAttribute('rel') || '')),
    lockups.map((a) => a.getAttribute('target') + ' / ' + a.getAttribute('rel')));

  check('each is marked rel="sponsored", which is what it is',
    lockups.length === page.spots && lockups.every((a) => /\bsponsored\b/.test(a.getAttribute('rel') || '')),
    lockups.map((a) => a.getAttribute('rel')));

  // On /accelerator the wording is inside the link. In the portal it moved
  // out to the .trp-credits group it shares with Wispr Flow, so it is said
  // once over the pair rather than once per sponsor.
  check('each reads "Powered by" before the logo',
    lockups.length === page.spots && lockups.every((a) => {
      const scope = page.themed ? a.closest('.trp-credits') : a;
      return scope !== null && /powered by/i.test(scope.textContent);
    }),
    lockups.map((a) => (a.closest('.trp-credits') || a).textContent.replace(/\s+/g, ' ').trim()));

  /* ---- the image ---- */

  const imgs = lockups.flatMap((a) => [...a.querySelectorAll('img')]);
  const perLockup = page.themed ? 2 : 1;

  check('each lockup carries ' + perLockup + ' logo file(s)',
    lockups.length === page.spots && lockups.every((a) => a.querySelectorAll('img').length === perLockup),
    lockups.map((a) => a.querySelectorAll('img').length));

  check('every logo has alt="Stanley", so the credit survives images off',
    imgs.length > 0 && imgs.every((i) => i.getAttribute('alt') === 'Stanley'),
    imgs.map((i) => i.getAttribute('alt')));

  check('every logo sets width and height, so nothing shifts as it loads',
    imgs.length === page.spots * perLockup && imgs.every((i) => /^\d+$/.test(i.getAttribute('width') || '') &&
      /^\d+$/.test(i.getAttribute('height') || '')),
    imgs.map((i) => i.getAttribute('width') + 'x' + i.getAttribute('height')));

  check('and sets them to the file\'s own 765x203, so the shape is right',
    imgs.length > 0 && imgs.every((i) => i.getAttribute('width') === '765' && i.getAttribute('height') === '203'),
    imgs.map((i) => i.getAttribute('width') + 'x' + i.getAttribute('height')));

  check('every logo points at the transparent copy in brand/partners/',
    imgs.length > 0 && imgs.every((i) => (i.getAttribute('src') || '').endsWith(page.themed ? '.png' : LIGHT) &&
      (i.getAttribute('src') || '').includes('brand/partners/')),
    imgs.map((i) => i.getAttribute('src')));

  check('it is the knocked-out copy, never the white-background original',
    imgs.length > 0 && imgs.every((i) => !(i.getAttribute('src') || '').includes('stanley/stanley-logo')),
    imgs.map((i) => i.getAttribute('src')));

  if (page.themed) {
    check('each lockup has one file for the light theme and one for the dark',
      lockups.length === page.spots && lockups.every((a) => {
        const src = [...a.querySelectorAll('img')].map((i) => i.getAttribute('src'));
        return src.some((s) => s.endsWith(LIGHT)) && src.some((s) => s.endsWith(DARK));
      }),
      lockups.map((a) => [...a.querySelectorAll('img')].map((i) => i.getAttribute('src'))));

    check('and the theme can tell them apart',
      lockups.length === page.spots && lockups.every((a) => a.querySelector('img.trp-powered-pos') &&
        a.querySelector('img.trp-powered-rev')));
  }
}

/* ---- where on the page it sits ------------------------------------------ */

console.log('\n/accelerator — where the two lockups sit');
{
  const document = doc('accelerator/index.html');
  const [hero, foot] = [...document.querySelectorAll('.powered')];

  check('the first is in the hero', hero.closest('.s-hero') !== null);
  check('and comes after the hero CTA and its micro line',
    hero.previousElementSibling.classList.contains('two') &&
    hero.closest('.hero-copy').querySelector('.cta') !== null);

  check('the second is in the closing band', foot.closest('.s-final') !== null);
  check('and comes after the final CTA, at the foot of the page',
    foot.previousElementSibling.classList.contains('act'));
  check('nothing but the legal bar follows it',
    foot.closest('section').nextElementSibling.classList.contains('legalbar'));
}

console.log('\n/portal — where the lockups sit');
{
  const signin = doc('club/signin.html');
  const lockup = signin.querySelector('.trp-powered');
  // The card is the portal's shared .glass-card now rather than a one-off
  // rounded box written on the page, but it is still the card and the
  // lockup is still directly under it.
  check('the sign-in page has it under the card, inside <main>',
    lockup.closest('main') !== null &&
    lockup.closest('p').previousElementSibling.className.includes('glass-card'),
    lockup.closest('p').previousElementSibling.className);
  check('and nothing else follows it on that page',
    lockup.closest('p').nextElementSibling === null);
  // No portal header on the sign-in page, so there is no masthead to sit in.
  check('the sign-in page has no portal header, and still only one lockup',
    signin.querySelector('header#top-nav') === null &&
    signin.querySelectorAll('a.trp-powered').length === 1,
    signin.querySelectorAll('a.trp-powered').length);

  for (const page of PAGES.filter((p) => p.path !== 'club/signin.html' &&
                                         p.path.startsWith('club/'))) {
    const document = doc(page.path);
    const inFooter = [...document.querySelectorAll('footer .trp-powered')];
    const inHeader = [...document.querySelectorAll('header#top-nav .trp-powered')];

    // Counted across the whole document, not just the two places it has ever
    // lived. A second credit anywhere is the bug this pins.
    const everywhere = [...document.querySelectorAll('a.trp-powered')];
    check(page.path + ': exactly one lockup on the page, counted everywhere',
      everywhere.length === 1, everywhere.length);

    check(page.path + ': and that one is in the footer',
      inFooter.length === 1 && inHeader.length === 0,
      { header: inHeader.length, footer: inFooter.length });

    // The masthead is now the wordmark, the menu and the member's own
    // controls, and nothing else. The credit moved to the quiet line at the
    // foot of the page, which is where it was before it went up there --
    // the difference being that there is only one of it now.
    const header = document.querySelector('header#top-nav');
    const bar = header.firstElementChild;
    const rightGroup = bar.lastElementChild;
    check(page.path + ': the header carries no Stanley logo at all',
      header.querySelectorAll('a.trp-powered').length === 0,
      header.querySelectorAll('a.trp-powered').length);
    check(page.path + ': the right-hand group is the theme, the name and Sign out',
      Boolean(rightGroup.querySelector('.trp-theme')) &&
      Boolean(rightGroup.querySelector('[data-portal-name]')) &&
      Boolean(rightGroup.querySelector('[data-portal-signout]')));

    // It sits on the footer line itself rather than in a band under it, so
    // the footer is still one line, and the group it shares with Wispr Flow
    // is the last thing on it.
    const footLine = document.querySelector('footer .trp-foot');
    const group = document.querySelector('footer .trp-credits');
    check(page.path + ': the lockup is on the footer line, not below it',
      footLine !== null && footLine.contains(inFooter[0]));
    check(page.path + ': it is inside the sponsor group',
      group !== null && group.contains(inFooter[0]));
    check(page.path + ': and that group is the last item on the line',
      footLine !== null && footLine.lastElementChild === group,
      footLine && footLine.lastElementChild && footLine.lastElementChild.className);
    check(page.path + ': with a separator before it, like every other item',
      group !== null && group.previousElementSibling !== null &&
      group.previousElementSibling.className.includes('trp-foot-sep'),
      group && group.previousElementSibling && group.previousElementSibling.className);

    // The one credit on the page cannot be hidden at any width.
    check(page.path + ': it is shown at every width, phone included',
      !/\bhidden\b/.test(inFooter[0].className) &&
      !/\bxl:inline-flex\b/.test(inFooter[0].className),
      inFooter[0].className);

    check(page.path + ': and it is marked as the footer one, so the ' +
      'stylesheet sizes it for that line',
      /\btrp-powered-foot\b/.test(inFooter[0].className),
      inFooter[0].className);

    // The wording is read on this line at every width: the footer has room
    // for it, unlike the masthead it came from.
    check(page.path + ': the "Powered by" wording is drawn, not clipped',
      group !== null && group.querySelector('.trp-powered-label') !== null);
  }
}

/* ---- Wispr Flow, the second sponsor -------------------------------------- */

// Wispr Flow is the official voice partner, and its credit sits beside
// Stanley's in the same group on every page that carries one. Its artwork is
// a near-black rounded tile rather than a wordmark, so without the words
// beside it the footer showed a stray black square with nothing to name it.
console.log('\nWispr Flow — the second credit');
{
  // One referral URL, everywhere. It has been written two different ways
  // already, and a credit pointing somewhere else is a credit nobody is
  // paid for -- so the sweep at the foot of this file checks the whole
  // portal rather than just the footers.
  const WISPR = 'https://ref.wisprflow.ai/ella-cook-vt27';
  const TILE = 'os/img/wispr-flow.png';

  for (const page of PAGES.filter((p) => p.path.startsWith('club/'))) {
    const document = doc(page.path);
    const credits = [...document.querySelectorAll('a.trp-credit')];

    check(page.path + ': exactly one Wispr Flow credit', credits.length === 1, credits.length);
    if (credits.length !== 1) continue;
    const credit = credits[0];

    check(page.path + ': pointed at the partner URL',
      credit.getAttribute('href') === WISPR, credit.getAttribute('href'));
    check(page.path + ': opening in a new tab, marked sponsored',
      credit.getAttribute('target') === '_blank' &&
      /\bnoopener\b/.test(credit.getAttribute('rel') || '') &&
      /\bsponsored\b/.test(credit.getAttribute('rel') || ''),
      credit.getAttribute('rel'));

    const img = credit.querySelector('img');
    check(page.path + ': it draws the repo\'s own Wispr mark',
      img !== null && (img.getAttribute('src') || '').endsWith(TILE),
      img && img.getAttribute('src'));
    check(page.path + ': with width and height, so nothing shifts as it loads',
      img !== null && img.getAttribute('width') === '256' && img.getAttribute('height') === '256',
      img && img.getAttribute('width') + 'x' + img.getAttribute('height'));
    check(page.path + ': the tile is decorative; the words beside it are the name',
      img !== null && img.getAttribute('alt') === '' &&
      credit.textContent.replace(/\s+/g, ' ').trim() === 'Wispr Flow',
      credit.textContent.trim());

    // Both sponsors in one group, in order, with the wording over the pair.
    const group = credit.closest('.trp-credits');
    check(page.path + ': it sits with Stanley in one credit group',
      group !== null && group.querySelector('a.trp-powered') !== null);
    check(page.path + ': Stanley first, Wispr Flow second',
      group !== null &&
      [...group.querySelectorAll('a')].map((a) => a.className.split(' ')[0])
        .join(',') === 'trp-powered,trp-credit',
      group && [...group.querySelectorAll('a')].map((a) => a.className));
  }

  // The tile file itself.
  const bytes = readFileSync(new URL('../../' + TILE, import.meta.url));
  check(TILE + ' is there and is a PNG',
    bytes.length > 0 && bytes.subarray(1, 4).toString('latin1') === 'PNG');
  check(TILE + ' is the 256x256 the markup declares',
    bytes.readUInt32BE(16) === 256 && bytes.readUInt32BE(20) === 256,
    bytes.readUInt32BE(16) + 'x' + bytes.readUInt32BE(20));
}

/* ---- one Wispr Flow URL, across the whole portal ------------------------- */

// Every link to Wispr Flow is the same referral URL. It has been written two
// different ways already -- the Club footer carried one and the new footers
// another -- and a credit pointed anywhere else is traffic nobody is paid
// for. So this sweeps the folder rather than the six footers, and takes in
// /contentworkshop, which carries its own download link.
console.log('\nevery Wispr Flow link is the one referral URL');
{
  const WISPR = 'https://ref.wisprflow.ai/ella-cook-vt27';
  /* The one exception is the Resources card's main button, which goes to
     Ella's redeem page: that address carries the promo code and the term,
     which the referral link cannot. The referral is still on that card -- it
     is on "Download it" in step one, where the download actually happens,
     and portal-resources.test.mjs is what holds it there.

     Written with &amp; in the markup, so it is matched as the sweep finds it. */
  const REDEEM = 'https://wisprflow.ai/info/redeem-promo?code=TIMERICH6&amp;months=6';
  const FILES = readdirSync(new URL('../../club/', import.meta.url))
    .filter((f) => /\.(html|js)$/.test(f))
    .map((f) => ['club/' + f, read('club/' + f)])
    .concat([['contentworkshop/index.html', read('contentworkshop/index.html')]]);

  check('there are files to sweep', FILES.length > 10, FILES.length);

  // Every wisprflow.ai URL anywhere in those files, however it was written.
  const found = FILES.flatMap(([file, body]) =>
    [...body.matchAll(/https?:\/\/[^"'\s<>)]*wisprflow\.ai[^"'\s<>)]*/g)]
      .map((m) => [file, m[0]]));

  check('the portal links to Wispr Flow at all', found.length > 0, found.length);
  check('and every one of those links is the referral URL, bar the redeem page',
    found.every(([, url]) => url === WISPR || url === REDEEM),
    found.filter(([, url]) => url !== WISPR && url !== REDEEM));

  // Allowed in exactly one place, so this cannot become a licence to point
  // the footer credits at it too.
  const redeems = found.filter(([, url]) => url === REDEEM);
  check('the redeem page appears once, on the Resources card',
    redeems.length === 1 && redeems[0][0] === 'club/resources.html', redeems);

  // Named, rather than left to the sweep above, because this is the one that
  // was changed by hand and changed back.
  for (const [file, body] of FILES) {
    if (!body.includes('trp-credit"')) continue;
    const document = new JSDOM(body).window.document;
    const credit = document.querySelector('a.trp-credit');
    check(file + ': the footer credit points at the referral URL',
      credit !== null && credit.getAttribute('href') === WISPR,
      credit && credit.getAttribute('href'));
  }
}

/* ---- no runtime swap ----------------------------------------------------- */

// The footer credit used to be rebuilt by portal-chrome.js: it threw away the
// real artwork and put back a cropped crop of a second file, greyed out and
// positioned with fixed negative offsets, which on the live portal read as an
// oversized grey mark that did not line up with the text beside it. The
// markup is the markup now.
console.log('\nthe artwork is never swapped at runtime');
{
  const chrome = read('club/portal-chrome.js');
  const content = read('club/portal-content.css');
  check('portal-chrome.js no longer rewrites the credit',
    !chrome.includes('trp-stanley-clean') && !chrome.includes('stanley-clean.png'));
  check('and it no longer reaches into .trp-powered or .trp-credit at all',
    !chrome.includes('.trp-powered') && !chrome.includes('.trp-credit'));
  check('the .trp-stanley-clean rules are gone with it',
    !content.includes('trp-stanley-clean'));
  check('and so is the cropped file nothing else used',
    !existsSync(new URL('../../portal/assets/stanley-clean.png', import.meta.url)));
}

/* ---- the files the markup points at ------------------------------------- */

console.log('\nbrand/partners — the files themselves');
{
  for (const file of [LIGHT, DARK]) {
    let bytes = null;
    try { bytes = readFileSync(new URL('../../' + file, import.meta.url)); } catch (e) { /* reported below */ }
    check(file + ' is there', bytes !== null && bytes.length > 0);
    if (!bytes) continue;
    check(file + ' is a PNG', bytes.subarray(1, 4).toString('latin1') === 'PNG');

    // IHDR: width, height and colour type, straight off the front of the file.
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    const colourType = bytes[25];
    check(file + ' is 765x203, the artwork with the white ground trimmed off',
      width === 765 && height === 203, width + 'x' + height);
    check(file + ' carries an alpha channel, so there is no white box',
      colourType === 6 || colourType === 4 || colourType === 3, colourType);
  }

  // The original stays as it was: it is what the transparent copies are cut
  // from, and the brief asked for it to be left alone.
  const original = readFileSync(new URL('../../stanley/stanley-logo.png', import.meta.url));
  check('the original stanley/stanley-logo.png is untouched and still opaque',
    original.readUInt32BE(16) === 765 && original.readUInt32BE(20) === 227 &&
    original[25] === 2,
    original.readUInt32BE(16) + 'x' + original.readUInt32BE(20) + ' type ' + original[25]);
}

/* ---- the one shared style block ----------------------------------------- */

console.log('\nthe style, written once per site rather than per page');
{
  // One block lays the lockup out; the only other mention is the phone step
  // down inside the page's existing 520px media query.
  const accelerator = read('accelerator/index.html');
  check('/accelerator lays .powered out in one block, not once per placement',
    (accelerator.match(/\.v2 \.powered\{display:inline-flex/g) || []).length === 1,
    (accelerator.match(/\.v2 \.powered\{display:inline-flex/g) || []).length);

  const src = read('club/portal-tailwind-src.css');
  check('the portal styles .trp-powered once, in the Tailwind source',
    (src.match(/\n  \.trp-powered \{/g) || []).length === 1);
  check('the built portal.css has it, so the source was rebuilt',
    /\.trp-powered\{/.test(read('club/portal.css')));
  check('and the built CSS knows about the dark swap',
    /trp-powered-rev/.test(read('club/portal.css')));

  // The wording is clipped, not removed, below 640px: a credit that is
  // display:none would not be read out either.
  check('the phone step-down clips the wording rather than removing it',
    /\.trp-powered-head \.trp-powered-label \{[^}]*position: absolute/.test(src) &&
    !/\.trp-powered-head \.trp-powered-label \{[^}]*display: none/.test(src));
  check('and the built CSS carries that step-down too',
    /trp-powered-head \.trp-powered-label\{/.test(read('club/portal.css')));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
