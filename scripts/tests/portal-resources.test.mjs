// The Resources page.
//
// It used to be a download page: a skill library grouped by week, each row
// with a gated ZIP button, and a seven-step accordion explaining how to
// upload one. Members install nothing now, so all of that is gone and the
// page opens instead with the three partner offers that come with a place on
// the accelerator.
//
// What this suite pins is the shape of that change: the three cards point at
// the right places and are marked as sponsored, the logos are shown as the
// partners ship them rather than knocked back to grey, and nothing on the
// page still asks anyone to download or install a skill.
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const HTML = read('portal/resources.html');
const SRC = read('portal/portal-tailwind-src.css');
const BUILT = read('portal/portal.css');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

// The page is loaded without running its own scripts: everything here is in
// the markup, which is the point. The payload-driven part of the page (the
// "Where things live" links card) is not under test.
const doc = new JSDOM(HTML, {
  url: 'https://timerich.ai/portal/resources.html',
  virtualConsole: new VirtualConsole(),
}).window.document;

const PARTNERS = [
  {
    name: 'Stanley',
    href: 'https://x.getstanley.ai/r/mz4y9g',
    logo: '../brand/partners/stanley-logo.png',
    line: '6 months of Stanley free with code TIMERICH6. Your AI head of content: drafts from your calls, learns your voice, posts for you.',
  },
  {
    name: 'Wispr Flow',
    href: 'https://ref.wisprflow.ai/ella-cook-vt27',
    logo: '../os/img/wispr-flow.png',
    line: '6 months of Wispr Flow Pro, the voice dictation app the accelerator runs on.',
  },
  {
    name: 'LaunchLemonade',
    href: 'https://studio.launchlemonade.app/signup?voucher=ACCELERATOR',
    logo: '../brand/partners/launchlemonade-logo.jpg',
    line: '3 months of LaunchLemonade included.',
    // The one card that is not a link itself: it links out through its own
    // Sign up button, which carries the voucher.
    button: true,
  },
];

console.log('\nResources: your partner offers');
{
  const section = doc.querySelector('section[aria-labelledby="partners-heading"]');
  check('the section is there and named', section !== null &&
    doc.getElementById('partners-heading') !== null &&
    doc.getElementById('partners-heading').textContent === 'Your partner offers');

  const cards = [...doc.querySelectorAll('.trp-partner')];
  check('three cards, no more', cards.length === 3, cards.length);

  // First on the page: before the agent table, before the questions.
  const main = doc.querySelector('main');
  const order = [...main.querySelectorAll('section')];
  check('they come first, before the agent guide and the questions',
    order[0] === section, order.slice(0, 2).map((s) => s.getAttribute('aria-labelledby')));

  PARTNERS.forEach((partner, i) => {
    // Guarded: with no cards at all every line below would throw, and a suite
    // that dies halfway reports far less than it knows.
    const card = cards[i] || doc.createElement('a');
    const img = card.querySelector('img:not(.trp-powered-rev)') || doc.createElement('img');
    const line = card.querySelector('.trp-partner-line') || doc.createElement('span');
    const link = partner.button
      ? card.querySelector('a.trp-partner-btn') || doc.createElement('a')
      : card;
    check(partner.name + ': links out to the right place',
      link.getAttribute('href') === partner.href, link.getAttribute('href'));
    check(partner.name + ': opens in a new tab, declared as sponsored',
      link.getAttribute('target') === '_blank' &&
      link.getAttribute('rel') === 'noopener sponsored',
      link.getAttribute('target') + ' / ' + link.getAttribute('rel'));
    check(partner.name + ': shows its logo',
      img !== null && img.getAttribute('src') === partner.logo, img && img.getAttribute('src'));
    check(partner.name + ': the logo is named, not left as empty alt',
      img.getAttribute('alt') === partner.name, img.getAttribute('alt'));
    // Without width and height the three cards jump as the logos arrive.
    check(partner.name + ': the logo carries its own dimensions',
      Number(img.getAttribute('width')) > 0 && Number(img.getAttribute('height')) > 0,
      img.getAttribute('width') + 'x' + img.getAttribute('height'));
    check(partner.name + ': and the line Ella wrote for it',
      line.textContent === partner.line, line.textContent);
  });

  // LaunchLemonade: title, the three redeem steps and a Sign up button, and
  // no link wrapped around the card, since a link cannot hold another link.
  const lemon = cards[2] || doc.createElement('div');
  const title = lemon.querySelector('.trp-partner-title');
  check('LaunchLemonade: titled with the offer',
    title !== null && title.textContent === 'LaunchLemonade · 3 months Pro',
    title && title.textContent);
  const steps = [...lemon.querySelectorAll('.trp-partner-steps li')].map((li) => li.textContent);
  check('LaunchLemonade: the three redeem steps, in order',
    JSON.stringify(steps) === JSON.stringify([
      'Click Sign up.',
      'Create your account (no card needed).',
      'Pro is active for 3 months.',
    ]), steps);
  const signUp = lemon.querySelector('a.trp-partner-btn');
  check('LaunchLemonade: the button says Sign up and uses the site button style',
    signUp !== null && signUp.textContent.trim() === 'Sign up' &&
    signUp.classList.contains('trp-btn') && signUp.classList.contains('trp-btn-primary'),
    signUp && signUp.textContent);
  check('LaunchLemonade: the card itself is not a link',
    lemon.tagName === 'DIV' && lemon.querySelectorAll('a').length === 1, lemon.tagName);
  check('the built stylesheet carries the LaunchLemonade card rules',
    BUILT.includes('.trp-partner-title{') && BUILT.includes('.trp-partner-steps{') &&
    BUILT.includes('.trp-partner-btn{'));

  // Stanley is the only one with a reversed file, and it swaps on the dark
  // theme the way the header lockup does.
  const stanley = cards[0] || doc.createElement('a');
  check('Stanley carries both its files, light and reversed',
    stanley.querySelector('.trp-powered-pos') !== null &&
    stanley.querySelector('.trp-powered-rev') !== null &&
    stanley.querySelector('.trp-powered-rev').getAttribute('src') ===
      '../brand/partners/stanley-logo-dark.png');
  check('and the reversed one is hidden until the dark theme asks for it',
    /\.trp-partner-mark \.trp-powered-rev \{ display: none; \}/.test(SRC) &&
    /:root\[data-theme='dark'\] \.trp-partner-mark \.trp-powered-rev \{ display: block; \}/.test(SRC));
  check('including for anyone on system dark',
    /@media \(prefers-color-scheme: dark\) \{[\s\S]{0,400}:root\[data-theme='system'\] \.trp-partner-mark \.trp-powered-rev \{ display: block; \}/.test(SRC));

  // "Full-colour logos, no grayscale."
  const markRules = (SRC.match(/\.trp-partner[\s\S]*?\n\n/) || [''])[0];
  check('no filter is laid over any of them',
    !/filter\s*:/.test(markRules) && !/grayscale/.test(markRules), markRules.match(/.*filter.*/));

  // They are other people's marks, so the card must not recolour them either.
  check('the card tints its own line, never the logo',
    /\.trp-partner:hover \.trp-partner-line \{ color: var\(--trp-ink\); \}/.test(SRC));

  check('the built stylesheet carries the cards, so the source was rebuilt',
    BUILT.includes('.trp-partner{') && BUILT.includes('.trp-partner-mark'),
    BUILT.includes('trp-partner'));
}

console.log('\nResources: the skill library is gone');
{
  check('no "Skill library" heading', !/Skill library/.test(HTML),
    (HTML.match(/.{0,40}Skill library.{0,40}/) || [])[0]);
  check('no "How to add a skill"', !/How to add a skill/.test(HTML),
    (HTML.match(/.{0,40}How to add a skill.{0,40}/) || [])[0]);
  check('the box the skills were drawn into is gone',
    doc.getElementById('skill-library') === null);
  check('and the renderer that filled it',
    !/renderSkills/.test(HTML) && !/skillButton/.test(HTML),
    (HTML.match(/.{0,30}(renderSkills|skillButton).{0,30}/) || [])[0]);

  // The Install label was the anchor the steps hung off. Nothing points at
  // them any more because there are no steps to point at.
  const text = doc.querySelector('main').textContent.replace(/\s+/g, ' ');
  check('nothing on the page is labelled Install', !/\bInstall\b/.test(text),
    (text.match(/.{0,40}Install.{0,40}/) || [])[0]);
  check('no in-page link is left pointing at a section that has gone',
    [...doc.querySelectorAll('main a[href^="#"]')]
      .every((a) => doc.querySelector(a.getAttribute('href')) !== null),
    [...doc.querySelectorAll('main a[href^="#"]')].map((a) => a.getAttribute('href')));

  // Nobody is asked to download or upload anything any more.
  check('the page does not ask anyone to download a ZIP',
    !/\.zip/i.test(text) && !/Download the ZIP/.test(text),
    (text.match(/.{0,40}zip.{0,40}/i) || [])[0]);
  check('and there are no numbered install steps left',
    doc.querySelectorAll('.trp-step-title').length === 0);
}

console.log('\nResources: the page says what it is now');
{
  const lede = doc.querySelector('main header p') || doc.createElement('p');
  check('the subtitle is the one from the brief',
    lede.textContent.trim() === 'Your partner offers, agent guide and answers.',
    lede.textContent.trim());
  // The two parts it still has, both still on the page.
  check('the agent guide is still there',
    doc.getElementById('agents-heading') !== null);
  check('and the questions', doc.getElementById('faq-heading') !== null);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
