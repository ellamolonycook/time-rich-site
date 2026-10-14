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
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

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
  { path: 'portal/index.html', selector: '.trp-powered', spots: 1, themed: true },
  { path: 'portal/dashboard.html', selector: '.trp-powered', spots: 2, themed: true },
  { path: 'portal/curriculum.html', selector: '.trp-powered', spots: 2, themed: true },
  { path: 'portal/sessions.html', selector: '.trp-powered', spots: 2, themed: true },
  { path: 'portal/prompts.html', selector: '.trp-powered', spots: 2, themed: true },
  { path: 'portal/resources.html', selector: '.trp-powered', spots: 2, themed: true },
  { path: 'portal/members.html', selector: '.trp-powered', spots: 2, themed: true },
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

  check('each reads "Powered by" before the logo',
    lockups.length === page.spots && lockups.every((a) => /powered by/i.test(a.textContent)),
    lockups.map((a) => a.textContent.replace(/\s+/g, ' ').trim()));

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
  const signin = doc('portal/index.html');
  const lockup = signin.querySelector('.trp-powered');
  check('the sign-in page has it under the card, inside <main>',
    lockup.closest('main') !== null &&
    lockup.closest('p').previousElementSibling.className.includes('rounded-'),
    lockup.closest('p').previousElementSibling.className);
  check('and nothing else follows it on that page',
    lockup.closest('p').nextElementSibling === null);

  for (const page of PAGES.filter((p) => p.path !== 'portal/index.html' &&
                                         p.path.startsWith('portal/'))) {
    const document = doc(page.path);
    const inFooter = [...document.querySelectorAll('footer .trp-powered')];
    const inHeader = [...document.querySelectorAll('header#top-nav .trp-powered')];

    check(page.path + ': one in the footer, on every page inside',
      inFooter.length === 1, inFooter.length);
    check(page.path + ': one in the header, beside the Time Rich wordmark',
      inHeader.length === 1 &&
      inHeader[0].previousElementSibling.textContent.includes('Time Rich'),
      inHeader.length);
    check(page.path + ': the header one is held back until 1280px, so a phone ' +
      'sees the footer and nothing else',
      /\bhidden\b/.test(inHeader[0].className) &&
      /\bxl:inline-flex\b/.test(inHeader[0].className),
      inHeader[0].className);
  }
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

  const src = read('portal/portal-tailwind-src.css');
  check('the portal styles .trp-powered once, in the Tailwind source',
    (src.match(/\n  \.trp-powered \{/g) || []).length === 1);
  check('the built portal.css has it, so the source was rebuilt',
    /\.trp-powered\{/.test(read('portal/portal.css')));
  check('and the built CSS knows about the dark swap',
    /trp-powered-rev/.test(read('portal/portal.css')));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
