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
//
// Each card also carries the steps for claiming its offer. Two of the three
// hand over a code to type in by hand, and neither puts it where you would
// expect -- Stanley's goes in behind "Add promotion code" on the payment
// page, Wispr's at the foot of Settings and not at checkout at all -- so
// the steps and the code are pinned here as closely as the links are.
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const HTML = read('club/resources.html');
const SRC = read('club/portal-tailwind-src.css');
const BUILT = read('club/portal.css');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

// The page is loaded without running its own scripts: everything here is in
// the markup, which is the point. The payload-driven part of the page (the
// "Where things live" links card) is not under test.
const doc = new JSDOM(HTML, {
  url: 'https://timerich.ai/club/resources.html',
  virtualConsole: new VirtualConsole(),
}).window.document;

// All three cards have the same shape now: a logo, a title, one line, the
// numbered steps to claim the offer, an optional tip under them, and a
// single button. None of them is a link itself -- the button is, and a link
// cannot sit inside another link.
//
// Stanley and Wispr both hand over a code to type in by hand, and neither
// puts it where you would expect, so the steps and the tip are the offer
// here as much as the link is. LaunchLemonade's voucher travels in its URL,
// so it needs no code and no tip.
const PARTNERS = [
  {
    name: 'Stanley',
    href: 'https://x.getstanley.ai/r/mz4y9g',
    logo: '../brand/partners/stanley-logo.png',
    title: 'Stanley \u00b7 6 months free',
    line: 'Your AI head of content. The code goes in at checkout.',
    // New to Stanley (11 steps), then already on the free plan (5 steps),
    // each in its own dropdown.
    steps: [
      "On your laptop, go to getstanley.ai.",
      "Click Log in (top of the page, not “Message Stanley”).",
      "Click Sign up.",
      "Choose Sign up with email or Google. Ignore the iMessage option on this screen.",
      "Enter your email and create a password. Use the email you want tied to your account. Click Continue.",
      "Verify your email. Check your inbox for a login code and enter it.",
      "Answer the duplicate account check. If you’ve never texted Stanley before, click No, I’m new to Stanley. The next page can take a few seconds to load.",
      "Pick the $49/month plan. Click Start your 14-day free trial. Checkout opens.",
      "Click Pay without Link to pay by card.",
      "Click Add promotion code, enter TIMERICH6 and click Apply. You should see 100% off for the next 6 billing cycles.",
      "Enter a payment method and click Start trial. You won’t be charged during the 6 free months.",
      "On your laptop, go to getstanley.ai and log in.",
      "Go to Upgrade and pick the $49/month plan. Click Start your 14-day free trial. Checkout opens.",
      "Click Pay without Link to pay by card.",
      "Click Add promotion code, enter TIMERICH6 and click Apply. You should see 100% off for the next 6 billing cycles.",
      "Enter a payment method and click Start trial. You won’t be charged during the 6 free months.",
    ],
    tip: 'Before you start: don’t click “Message Stanley” on the homepage. That route skips the promo code. Go in through email first. You can connect iMessage, WhatsApp or Telegram later.',
    button: 'Sign up',
    code: 'TIMERICH6',
  },
  {
    name: 'Wispr Flow',
    // The button goes to the redeem page, which carries the code and the
    // term. The referral link did not go away: it is on "Download it" in
    // step one, checked on its own further down.
    href: 'https://wisprflow.ai/info/redeem-promo?code=TIMERICH6&months=6',
    logo: '../os/img/wispr-flow.png',
    title: 'Wispr Flow \u00b7 6 months Pro',
    line: "Only works if you're new to Wispr Flow or on the free plan.",
    steps: [
      'Download it on your Mac or PC (not your phone).',
      'Open it and go to Settings \u2192 Plans and Billing.',
      'Scroll to the very bottom and click the promo code link.',
      'Enter TIMERICH6.',
    ],
    tip: "Only enter the code there. It won't work at checkout.",
    button: 'Redeem 6 months Pro',
    code: 'TIMERICH6',
  },
  {
    name: 'LaunchLemonade',
    href: 'https://studio.launchlemonade.app/signup?voucher=ACCELERATOR',
    logo: '../brand/partners/launchlemonade-logo.jpg',
    title: 'LaunchLemonade \u00b7 3 months Pro',
    line: '3 months of LaunchLemonade included.',
    steps: [
      'Click Sign up.',
      'Create your account (no card needed).',
      'Pro is active for 3 months.',
    ],
    // Its voucher rides in the signup URL, so there is nothing to mistype
    // and nothing to warn about.
    tip: null,
    button: 'Sign up',
    code: null,
  },
];

console.log('\nResources: your partner offers');
{
  const section = doc.querySelector('section[aria-labelledby="partners-heading"]');
  check('the section is there and named', section !== null &&
    doc.getElementById('partners-heading') !== null &&
    doc.getElementById('partners-heading').textContent === 'Your partner offers');

  // Scoped to the section: the three Superhuman agents further down the page
  // use the same card, and they are not partner offers.
  const cards = [...section.querySelectorAll('.trp-partner')];
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
    const link = card.querySelector('a.trp-partner-btn') || doc.createElement('a');
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

    const title = card.querySelector('.trp-partner-title');
    check(partner.name + ': titled with the offer',
      title !== null && title.textContent === partner.title, title && title.textContent);

    const steps = [...card.querySelectorAll('.trp-partner-steps li')].map((li) => li.textContent);
    check(partner.name + ': the redeem steps, in order',
      JSON.stringify(steps) === JSON.stringify(partner.steps), steps);

    const tip = card.querySelector('.trp-partner-tip');
    if (partner.tip) {
      check(partner.name + ': the tip under the steps',
        tip !== null && tip.textContent === partner.tip, tip && tip.textContent);
    } else {
      check(partner.name + ': no tip, because there is no code to get wrong',
        tip === null, tip && tip.textContent);
    }

    // The code is the whole offer for two of them, so it has to be on the
    // card rather than only in the link.
    if (partner.code) {
      check(partner.name + ': the code is on the card, in the steps',
        card.textContent.includes(partner.code) &&
        steps.some((t) => t.includes(partner.code)), steps);
    }

    check(partner.name + ': the button says what it does, in the site style',
      link.textContent.trim() === partner.button &&
      link.classList.contains('trp-btn') && link.classList.contains('trp-btn-primary'),
      link.textContent.trim());

    // A link cannot sit inside a link, which is why none of these cards is
    // one. There is exactly one button per card; links inside the steps are
    // fine and Wispr has one, so the count is of buttons, not of anchors.
    check(partner.name + ': the card is not a link, and holds exactly one button',
      card.tagName === 'DIV' && card.querySelectorAll('a.trp-partner-btn').length === 1,
      card.tagName + '/' + card.querySelectorAll('a.trp-partner-btn').length);
  });

  /* Every Wispr Flow link is the redeem page now, with the code and the
     term in the address (Ella's call, 25 Oct: it replaced the referral
     link everywhere). That includes "Download it" in step one. */
  {
    const wispr = cards.find((c) => /Wispr Flow/.test(
      (c.querySelector('.trp-partner-title') || {}).textContent || '')) || doc.createElement('div');
    const dl = wispr.querySelector('.trp-partner-steps a');
    check('Wispr: "Download it" in step one goes to the redeem page',
      dl !== null &&
      dl.getAttribute('href') === 'https://wisprflow.ai/info/redeem-promo?code=TIMERICH6&months=6' &&
      dl.textContent.trim() === 'Download it',
      dl && dl.getAttribute('href') + ' / ' + dl.textContent.trim());
    check('Wispr: and it opens in a new tab, declared as sponsored',
      dl !== null && dl.getAttribute('target') === '_blank' &&
      dl.getAttribute('rel') === 'noopener sponsored',
      dl && dl.getAttribute('target') + ' / ' + dl.getAttribute('rel'));
  }

  // The card rules have to be in the build, not just the source, or the
  // three cards arrive unstyled.
  check('the built stylesheet carries the partner card rules',
    BUILT.includes('.trp-partner-title{') && BUILT.includes('.trp-partner-steps{') &&
    BUILT.includes('.trp-partner-btn{') && BUILT.includes('.trp-partner-tip{'));

  // The buttons sit on the card's floor, so three cards of different
  // heights still line their buttons up on a desktop row.
  check('and pins the buttons to the foot of the card',
    SRC.includes('.trp-partner-btn {') && /\.trp-partner-btn \{[^}]*margin-top: auto;/.test(SRC));

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
  /* The subtitle under the heading is gone. Resources is a place in the top
     menu now rather than a card at the foot of the course, and Ella asked for
     the heading on its own: a member who tapped Resources does not need a
     line telling them what Resources is. What sits under the heading instead
     is the way back to the course. */
  const header = doc.querySelector('main header');
  check('no subtitle under the heading',
    header.querySelector('p') === null,
    header.querySelector('p') && header.querySelector('p').textContent.trim());
  check('and the way back to the course is there instead',
    header.querySelector('.trp-res-back') !== null);

  // The two parts it still has, both still on the page. The agent guide is
  // built by portal-agents.js now, which Week 1 of the Curriculum shares, so
  // what is pinned here is the box it goes in and the file that fills it.
  check('the agent guide is still there',
    doc.querySelector('[data-agents-block]') !== null &&
    read('club/resources.html').includes('portal-agents.js'));
  check('and the questions', doc.getElementById('faq-heading') !== null);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
