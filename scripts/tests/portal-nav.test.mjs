// The portal top nav: four places, and the one you are on is a filled green
// pill.
//
// This suite used to pin the opposite — a tab was text with a 2px line under
// it, and the assertions here said in so many words that it was "never a
// filled pill". The redesign puts the fill back, because a line read as a
// link rather than as a place. What is left of the old shape is the part
// that was right either way: the effect costs no layout, hover and keyboard
// focus behave the same, and the mobile slide-out menu keeps its own classes.
//
// The menu is four places now. Live Sessions and Prompts are not in it —
// both pages are still served, they are just reached from the course rather
// than steered to — and Club, Accelerator and Resources are. Members is
// shown to everyone with a purple Soon pill rather than being hidden until
// the Worker says the directory is open.
//
// jsdom does no layout and no painting, so what is checked here is the shape
// the look depends on, not the look.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

// club/index.html is the Club home; sessions and prompts are still here,
// still carrying the menu, just no longer in it.
const PAGES = ['index', 'dashboard', 'curriculum', 'sessions', 'resources', 'prompts', 'members'];

// What the menu is, in order, on every page.
const MENU = [
  // Club is the one absolute link: /club is the Club home itself now, which
  // is club/index.html. The public application form moved to /clubform and
  // is not in here at all -- the portal menu never points a member at it.
  //
  // The rest are extensionless. The .html files are all still served, so an
  // old bookmark still works, but nothing in the portal links to one.
  { href: '/club', label: 'Club' },
  { href: 'curriculum', label: 'Accelerator' },
  { href: 'resources', label: 'Resources' },
  { href: 'members', label: 'Members' },
];

// Which menu entry is lit on each page. Live Sessions and Prompts sit under
// the Accelerator, whose link points at the curriculum. The dashboard page
// is no longer a destination, so its own menu points there too. Resources
// has its own entry now, so it lights that rather than the Accelerator.
//
// The Club home's file is club/index.html and the address it is lit by is
// /club, which is the same page.
const LIT = {
  index: '/club',
  dashboard: 'curriculum',
  curriculum: 'curriculum',
  sessions: 'curriculum',
  prompts: 'curriculum',
  resources: 'resources',
  members: 'members',
};

const SRC = read('club/portal-tailwind-src.css');
const BUILT = read('club/portal.css');

// Whitespace between declarations differs between the source and the build,
// so both are squashed before anything is matched against them.
const tight = (css) => css.replace(/\s+/g, '');
const SRC_T = tight(SRC);
const BUILT_T = tight(BUILT);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

const docs = {};
for (const name of PAGES) docs[name] = new JSDOM(read('club/' + name + '.html')).window.document;

const navOf = (d) => d.querySelector('nav[aria-label="Portal"]');
const menuOf = (d) => d.getElementById('mobile-menu');

console.log('\nThe menu is the same four places on every page');
{
  for (const name of PAGES) {
    const links = [...navOf(docs[name]).querySelectorAll('a')];
    check(name + ': all four links, in order',
      JSON.stringify(links.map((a) => [a.getAttribute('href'), a.textContent.trim().split(/\s+/)[0]])) ===
      JSON.stringify(MENU.map((m) => [m.href, m.label])),
      links.map((a) => a.getAttribute('href')));

    // The two that came out. Checked by href so a stray "Prompts" in body
    // copy somewhere cannot fail this.
    const hrefs = links.map((a) => a.getAttribute('href'));
    check(name + ': Live Sessions and Prompts are not in it',
      ['sessions', 'prompts', 'sessions.html', 'prompts.html']
        .every((h) => !hrefs.includes(h)), hrefs);

    const mhrefs = [...menuOf(docs[name]).querySelectorAll('nav a')].map((a) => a.getAttribute('href'));
    check(name + ': nor in the phone menu',
      JSON.stringify(mhrefs) === JSON.stringify(MENU.map((m) => m.href)), mhrefs);
  }

  // The pages themselves are still served; only the way in changed.
  check('sessions.html and prompts.html are still here',
    docs.sessions.querySelector('title') !== null && docs.prompts.querySelector('title') !== null);
}

console.log('\nNo portal page links to a .html address');
{
  /* Every .html file is still there and still served -- renaming them would
     break every bookmark and every link already emailed out. What changed is
     that nothing in the portal POINTS at one any more, so a member moving
     through the site only ever sees the clean address. A link that goes back
     to the .html form is this regressing.

     Off-site links are skipped: what a partner serves is their business. */
  const dotHtml = /^(?!https?:|mailto:)[^:]*\.html(?:[?#]|$)/;
  for (const name of PAGES.concat(['signin'])) {
    const d = name === 'signin'
      ? new JSDOM(read('club/signin.html')).window.document
      : docs[name];
    const bad = [...d.querySelectorAll('a[href]')]
      .map((a) => a.getAttribute('href'))
      .filter((h) => dotHtml.test(h));
    check(name + ': no link on the page ends in .html', bad.length === 0, bad);
  }
}

console.log('\nThe page you are on is marked, in both menus');
{
  for (const name of PAGES) {
    for (const [what, root] of [['top nav', navOf(docs[name])], ['phone menu', menuOf(docs[name])]]) {
      const marked = [...root.querySelectorAll('[aria-current]')];
      check(name + ': exactly one entry in the ' + what + ' is current',
        marked.length === 1, marked.map((a) => a.getAttribute('href')));
      check(name + ': and it is the right one',
        marked.length === 1 && marked[0].getAttribute('href') === LIT[name],
        marked.map((a) => a.getAttribute('href')));

      // "page" is a claim about this document, so it is only used where the
      // link really is this page. Live Sessions and Prompts sit in the
      // Accelerator without being the curriculum, so they get the generic
      // "current item in this set" instead. The Club home is its own page
      // even though its link is /club rather than /index.
      const want = (LIT[name] === name || LIT[name] === '/' + name || name === 'index') ? 'page' : 'true';
      check(name + ': marked aria-current="' + want + '" in the ' + what,
        marked.length === 1 && marked[0].getAttribute('aria-current') === want,
        marked.map((a) => a.getAttribute('aria-current')));
    }
  }
}

console.log('\nThe active tab is a filled pill, and the quiet ones are not');
{
  for (const name of PAGES) {
    const nav = navOf(docs[name]);
    const active = nav.querySelector('.trp-nav-link[aria-current]');

    // Medium, not semibold. The second pass took the weight down across the
    // portal, and the weight is set by a utility in the markup, which beats
    // the stylesheet's own font-weight — so the markup is where it is
    // really decided and the only place worth checking.
    check(name + ': it is medium weight, not bold',
      /\bfont-medium\b/.test(active.className) && !/\bfont-semibold\b/.test(active.className),
      active.className);
    // The fill is the stylesheet's, not a utility: one rule to change, and
    // it cannot drift from page to page.
    check(name + ': the fill is not written into the markup',
      !/\bbg-/.test(active.className), active.className);

    const idle = [...nav.querySelectorAll('.trp-nav-link')].filter((a) => a !== active);
    check(name + ': no quiet tab carries a fill of its own',
      idle.every((a) => !/\bbg-/.test(a.className)),
      idle.map((a) => a.className).filter((c) => /bg-/.test(c)));
    check(name + ': the quiet tabs go to full ink on hover',
      idle.every((a) => /\btext-brand-ink\/70\b/.test(a.className) &&
        /\bhover:text-brand-ink\b/.test(a.className)));
  }
}

console.log('\nThe pill, in the stylesheet');
{
  check('a tab is a pill-shaped box with a 44px tap target',
    SRC_T.includes('.trp-nav-link{position:relative;display:inline-flex;align-items:center;min-height:44px;border-radius:999px;'),
    (SRC.match(/\.trp-nav-link \{[\s\S]*?\}/) || [])[0]);

  // The brand green and the paper, both by token, which is what makes the
  // pill invert on the dark theme without a rule of its own.
  check('the page you are on is filled with the brand green',
    SRC_T.includes('background:rgb(var(--c-green));color:rgb(var(--c-bg));font-weight:500;'),
    (SRC.match(/\.trp-nav-link\[aria-current='page'\],[\s\S]*?\}/) || [])[0]);
  check('and the fill covers hover and focus too, so it cannot be lifted off it',
    SRC_T.includes(".trp-nav-link[aria-current='page'],.trp-nav-link[aria-current='page']:hover,.trp-nav-link[aria-current='page']:focus-visible{"));

  // A quiet tab lifts on a tint. Hover and focus are one rule so they can
  // never drift apart, which is the one thing the old suite got right.
  check('a quiet tab lifts on a tint, on hover and on keyboard focus alike',
    SRC_T.includes('.trp-nav-link:hover,.trp-nav-link:focus-visible{background:rgb(var(--c-rule)/.06);}'),
    (SRC.match(/\.trp-nav-link:hover,[\s\S]*?\}/) || [])[0]);

  check('the transition is colour only, so nothing moves',
    SRC_T.includes('transition:color200msease,background-color200msease;'));
  check('the focus ring the page already had is left alone',
    !/\.trp-nav-link[^{]*\{[^}]*outline/.test(SRC));

  // The shape that was replaced. If this ever comes back, the two will
  // fight: a line under a filled pill.
  check('the old underline is gone from the source',
    !SRC.includes('--trp-nav-line') && !/\.trp-nav-link::after/.test(SRC));
  check('and from the build',
    !BUILT.includes('--trp-nav-line') && !BUILT_T.includes('.trp-nav-link:after{'));
}

console.log('\nThe build matches the source');
{
  check('the built stylesheet carries the pill radius',
    BUILT_T.includes('.trp-nav-link{') && /\.trp-nav-link\{[^}]*border-radius:999px/.test(BUILT_T),
    (BUILT.match(/\.trp-nav-link\{[^}]*\}/) || [])[0]);
  check('and the green fill on the active tab',
    /\.trp-nav-link\[aria-current=page\][^{]*\{[^}]*background:rgb\(var\(--c-green\)\)/.test(BUILT_T),
    (BUILT.match(/\.trp-nav-link\[aria-current=page\][^{]*\{[^}]*\}/) || [])[0]);
  check('and the quiet tab’s hover tint',
    /\.trp-nav-link:focus-visible,\.trp-nav-link:hover\{background:rgb\(var\(--c-rule\)\/\.06\)\}/.test(BUILT_T) ||
    /\.trp-nav-link:hover,\.trp-nav-link:focus-visible\{background:rgb\(var\(--c-rule\)\/\.06\)\}/.test(BUILT_T),
    (BUILT.match(/\.trp-nav-link:[a-z-]*(,\.trp-nav-link:[a-z-]*)?\{[^}]*\}/) || [])[0]);
}

console.log('\nMembers is in the menu for everyone, marked Soon');
{
  for (const name of PAGES) {
    for (const [what, root] of [['top nav', navOf(docs[name])], ['phone menu', menuOf(docs[name])]]) {
      const link = root.querySelector('[data-portal-members-link]');
      check(name + ': the ' + what + ' carries the Members link',
        link !== null && link.getAttribute('href') === 'members');
      // The attribute stays so portal-access.js still finds it; the markup
      // no longer starts it hidden.
      check(name + ': it is not hidden in the markup (' + what + ')',
        link !== null && !link.hasAttribute('hidden'));
      const pill = link && link.querySelector('.trp-soon');
      check(name + ': and it carries a Soon pill (' + what + ')',
        pill !== null && pill.textContent.trim() === 'Soon');
    }
  }

  // The two rules that used to hide it are gone, or it would still be
  // hidden the moment the Worker answered 403.
  const CONTENT = read('club/portal-content.css');
  check('nothing hides the link on [hidden] any more',
    !/\[data-portal-members-link\]\[hidden\]\s*\{\s*display:\s*none/.test(CONTENT),
    (CONTENT.match(/\[data-portal-members-link\]\[hidden\][^}]*\}/) || [])[0]);
  check('nor blanks it while the Worker is asked',
    !/\[data-portal-members-link\]\[data-pending\]\s*\{\s*visibility:\s*hidden/.test(CONTENT));

  // Purple is spent on "not yet" and nothing else.
  check('the Soon pill is the reserved purple',
    SRC_T.includes('.trp-soon{') &&
    SRC_T.includes('background:rgb(var(--c-plumbg));color:rgb(var(--c-plum));'),
    (SRC.match(/\.trp-soon \{[\s\S]*?\}/) || [])[0]);
  check('which is #EEEBFF on #4A3DB8 in light',
    /--c-plumbg: 238 235 255;/.test(SRC) && /--c-plum: 74 61 184;/.test(SRC));
  check('and is given a dark-theme pair, so it is not a hole in a dark page',
    /:root\[data-theme='dark'\][\s\S]*?--c-plumbg: 47 43 79;/.test(SRC) &&
    /:root\[data-theme='system'\][\s\S]*?--c-plumbg: 47 43 79;/.test(SRC));
}

console.log('\nThe wordmark goes to the Club home');
{
  for (const name of PAGES) {
    const marks = [...docs[name].querySelectorAll('a.trp-wordmark')];
    check(name + ': both wordmarks point at /club',
      marks.length === 2 && marks.every((a) => a.getAttribute('href') === '/club'),
      marks.map((a) => a.getAttribute('href')));
  }
}

console.log('\nThe Accelerator has no Dashboard option');
{
  for (const name of PAGES) {
    const row = docs[name].querySelector('nav.trp-subnav');
    check(name + ': carries no second row', row === null);
    const labels = [...docs[name].querySelectorAll('a')].map((a) => a.textContent.trim());
    check(name + ': no link is labelled Dashboard',
      !labels.some((label) => label === 'Dashboard' || label.startsWith('Dashboard ')),
      labels.filter((label) => /Dashboard/i.test(label)));
  }
}

console.log('\nThe phone menu keeps its own classes');
{
  for (const name of PAGES) {
    const menu = menuOf(docs[name]);
    check(name + ': the slide-out menu uses none of the nav-link styling',
      menu !== null && menu.querySelectorAll('.trp-nav-link').length === 0,
      menu && menu.querySelectorAll('.trp-nav-link').length);
    // Its own filled row is the brand green too, so the two menus agree.
    const current = menu.querySelector('[aria-current]');
    check(name + ': and marks the current page with the same green',
      /\bbg-brand-green\b/.test(current.className) && /\btext-brand-bg\b/.test(current.className),
      current.className);
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
