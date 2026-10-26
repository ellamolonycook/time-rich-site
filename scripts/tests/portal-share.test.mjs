// Link previews for the portal.
//
// Paste a /club link into Slack, WhatsApp or a DM and the preview is built
// from the meta in the head. Two things were wrong with it.
//
// The titles said "Time Rich Portal", which is not what the thing is called.
//
// And the /portal redirect pages had no og:image at all. A redirect page is
// four lines and a <meta refresh>, so a scraper that finds no image in the
// meta goes looking in the page -- and on a portal page the first image it
// reaches is a partner's logo tile. A member sharing the Club with a friend
// got Wispr Flow's square as the picture.
//
// So: every one of these pages carries a full set, with og:image on it, and
// none of them says "Time Rich Portal" anywhere.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

const IMAGE = 'https://timerich.ai/og-time-rich.png';
const DESC = 'Your weekly steps, prompts and session recordings for the Superhuman Accelerator.';

/* Every page a member can share, and the clean address each one shares as.
   A redirect shares as the page it sends them to, so the preview is right
   even when the old address is the one that was pasted. */
const PAGES = {
  // The portal itself.
  'club/index.html':      ['Time Rich Club',                 'https://timerich.ai/club'],
  'club/signin.html':     ['Sign in | Time Rich Club',       'https://timerich.ai/club/signin'],
  'club/curriculum.html': ['Curriculum | Time Rich Club',    'https://timerich.ai/club/curriculum'],
  'club/resources.html':  ['Resources | Time Rich Club',     'https://timerich.ai/club/resources'],
  // Live Sessions is gone: both of these are redirects to the Curriculum
  // now, and they share as the page they land on.
  'club/sessions.html':   ['Curriculum | Time Rich Club',    'https://timerich.ai/club/curriculum'],
  'club/prompts.html':    ['Prompts | Time Rich Club',       'https://timerich.ai/club/prompts'],
  'club/members.html':    ['Members | Time Rich Club',       'https://timerich.ai/club/members'],
  'club/dashboard.html':  ['Dashboard | Time Rich Club',     'https://timerich.ai/club/dashboard'],
  // The old /club/home address.
  'club/home.html':       ['Time Rich Club',                 'https://timerich.ai/club'],
  // The /portal redirects.
  'portal/index.html':      ['Sign in | Time Rich Club',       'https://timerich.ai/club/signin'],
  'portal/club.html':       ['Time Rich Club',                 'https://timerich.ai/club'],
  'portal/curriculum.html': ['Curriculum | Time Rich Club',    'https://timerich.ai/club/curriculum'],
  'portal/resources.html':  ['Resources | Time Rich Club',     'https://timerich.ai/club/resources'],
  'portal/sessions.html':   ['Curriculum | Time Rich Club',    'https://timerich.ai/club/curriculum'],
  'portal/prompts.html':    ['Prompts | Time Rich Club',       'https://timerich.ai/club/prompts'],
  'portal/members.html':    ['Members | Time Rich Club',       'https://timerich.ai/club/members'],
  'portal/dashboard.html':  ['Dashboard | Time Rich Club',     'https://timerich.ai/club/dashboard'],
};

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

for (const [path, [title, url]] of Object.entries(PAGES)) {
  console.log('\n' + path);
  const html = read(path);
  const d = new JSDOM(html).window.document;
  const meta = (selector) => {
    const node = d.querySelector(selector);
    return node ? node.getAttribute('content') : null;
  };

  check('the title is the one Ella asked for',
    d.title === title, d.title);
  // The one wording rule: it is the Club, not "the Portal".
  check('and "Time Rich Portal" is nowhere in the file',
    !html.includes('Time Rich Portal'),
    (html.match(/.{0,30}Time Rich Portal.{0,20}/) || [])[0]);

  check('og:title matches the title',
    meta('meta[property="og:title"]') === title, meta('meta[property="og:title"]'));
  check('og:description is the one line',
    meta('meta[property="og:description"]') === DESC, meta('meta[property="og:description"]'));
  check('og:url is the clean address',
    meta('meta[property="og:url"]') === url, meta('meta[property="og:url"]'));
  check('og:type says it is a page', meta('meta[property="og:type"]') === 'website');

  // The whole point: an image in the meta, so a scraper never has to go
  // looking in the page and find a partner's logo tile instead.
  check('og:image is set',
    meta('meta[property="og:image"]') === IMAGE, meta('meta[property="og:image"]'));
  check('with its size, so the card is laid out before the image arrives',
    meta('meta[property="og:image:width"]') === '1200' &&
    meta('meta[property="og:image:height"]') === '630',
    [meta('meta[property="og:image:width"]'), meta('meta[property="og:image:height"]')]);

  check('twitter:card is the large one',
    meta('meta[name="twitter:card"]') === 'summary_large_image', meta('meta[name="twitter:card"]'));
  check('and twitter:image is the same picture',
    meta('meta[name="twitter:image"]') === IMAGE, meta('meta[name="twitter:image"]'));
  check('with a title and a description of its own',
    meta('meta[name="twitter:title"]') === title && meta('meta[name="twitter:description"]') === DESC,
    [meta('meta[name="twitter:title"]'), meta('meta[name="twitter:description"]')]);

  check('a plain description for a scraper that reads neither',
    meta('meta[name="description"]') === DESC, meta('meta[name="description"]'));

  check('one canonical address, and it is the clean one',
    d.querySelectorAll('link[rel="canonical"]').length === 1 &&
    d.querySelector('link[rel="canonical"]').getAttribute('href') === url,
    [...d.querySelectorAll('link[rel="canonical"]')].map((l) => l.getAttribute('href')));

  // The meta has to be in the head to be read at all, and ahead of the body.
  check('all of it is in the head',
    [...d.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]')]
      .every((m) => d.head.contains(m)));

  // Exactly one of each, or a scraper picks whichever it likes.
  for (const prop of ['og:title', 'og:description', 'og:url', 'og:image']) {
    check('exactly one ' + prop,
      d.querySelectorAll('meta[property="' + prop + '"]').length === 1,
      d.querySelectorAll('meta[property="' + prop + '"]').length);
  }
}

console.log('\nNo partner tile can be picked as a preview');
{
  // Wispr Flow's square and Stanley's wordmark are the first images in the
  // body of a portal page. They are fine there; what must never happen is a
  // page reaching a scraper without an og:image above them.
  for (const path of Object.keys(PAGES)) {
    const html = read(path);
    const d = new JSDOM(html).window.document;
    const og = d.querySelector('meta[property="og:image"]');
    const firstImg = d.querySelector('img');
    check(path + ': the og:image comes before any image in the page',
      og !== null && (firstImg === null ||
        og.compareDocumentPosition(firstImg) & d.defaultView.Node.DOCUMENT_POSITION_FOLLOWING) > 0,
      firstImg && firstImg.getAttribute('src'));
    check(path + ': and it is not a partner mark',
      !/wispr|stanley|launchlemonade/i.test(og.getAttribute('content')),
      og.getAttribute('content'));
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
