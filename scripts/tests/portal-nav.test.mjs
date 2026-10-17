// The portal top nav: a tab is text with a line under it, not a filled pill.
//
// jsdom does no layout and no painting, so this suite cannot watch the line
// animate. What it can pin, and what actually regresses, is the shape the
// effect depends on: the active tab carries no fill in the markup or the
// stylesheet, the line is a ::after so it cannot move anything, hover and
// keyboard focus both draw it, the colour flips to lime on the dark theme,
// and somebody who asked for less motion gets the line without the slide.
//
// The mobile slide-out menu uses its own classes and is deliberately not
// touched; the last block here is what keeps it that way.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

const PAGES = ['dashboard', 'curriculum', 'sessions', 'resources', 'prompts', 'members'];
const SRC = read('portal/portal-tailwind-src.css');
const BUILT = read('portal/portal.css');

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

const doc = (name) => new JSDOM(read('portal/' + name + '.html')).window.document;

console.log('\nTop nav — the active tab is text, not a filled pill');
{
  for (const name of PAGES) {
    const d = doc(name);
    const nav = d.querySelector('nav[aria-label="Portal"]');
    const active = nav.querySelector('.trp-nav-link[aria-current="page"]');

    check(name + ': one tab is marked as the page you are on',
      nav.querySelectorAll('[aria-current="page"]').length === 1);
    check(name + ': it carries no background utility in the markup',
      !/\bbg-/.test(active.className), active.className);
    check(name + ': and no pill radius either',
      !/\brounded-/.test(active.className), active.className);
    check(name + ': it is still the heavier weight',
      /\bfont-semibold\b/.test(active.className), active.className);

    const idle = [...nav.querySelectorAll('.trp-nav-link')].filter((a) => a !== active);
    check(name + ': no tab has a hover fill left on it',
      idle.every((a) => !/\bhover:bg-/.test(a.className)),
      idle.map((a) => a.className).filter((c) => /hover:bg-/.test(c)));
    check(name + ': the quiet tabs still go to full ink on hover',
      idle.every((a) => /\btext-brand-ink\/70\b/.test(a.className) &&
        /\bhover:text-brand-ink\b/.test(a.className)));
  }
}

console.log('\nTop nav — the underline, in the stylesheet');
{
  // No fill anywhere in the rule set: that is the whole point of the change.
  // Matched against the squashed copy: the source writes "] {" with a space,
  // and a regex that assumed otherwise would pass no matter what was in there.
  check('the stylesheet gives the active tab no background',
    !/\.trp-nav-link\[aria-current='page'\]\{[^}]*background/.test(SRC_T),
    (SRC.match(/\.trp-nav-link\[aria-current='page'\] \{[\s\S]*?\}/) || [])[0]);
  check('the active tab is deep green and a little heavier',
    SRC_T.includes(".trp-nav-link[aria-current='page']{color:var(--trp-ink);font-weight:600;}"),
    (SRC.match(/\.trp-nav-link\[aria-current='page'\] \{[\s\S]*?\}/) || [])[0]);
  check('and its line is already out',
    SRC_T.includes(".trp-nav-link[aria-current='page']::after{transform:scaleX(1);}"));

  // A ::after cannot push anything around, which is what keeps the header at
  // its 64px whatever state a tab is in.
  check('the line is drawn with ::after, so it costs no layout',
    /\.trp-nav-link::after\s*\{/.test(SRC));
  check('it is absolutely placed, inset by the link’s own padding',
    SRC_T.includes('position:absolute;') && SRC_T.includes('left:14px;right:14px;'));
  check('it is a 2px line, not a border on the box',
    SRC_T.includes('height:2px;'));
  check('it rests at scaleX(0), out from the centre',
    SRC_T.includes('transform:scaleX(0);') && SRC_T.includes('transform-origin:center;'));
  check('and animates over about 200ms, ease-out',
    SRC_T.includes('transition:transform200msease-out;'),
    (SRC.match(/transition: transform[^;]*/) || [])[0]);

  // Hover and keyboard focus are the same line.
  check('hover draws it', /\.trp-nav-link:hover::after/.test(SRC));
  check('keyboard focus draws it too', /\.trp-nav-link:focus-visible::after/.test(SRC));
  check('both in one rule, so they can never drift apart',
    SRC_T.includes('.trp-nav-link:hover::after,.trp-nav-link:focus-visible::after{transform:scaleX(1);}'));
  check('the focus ring the page already had is left alone',
    !/\.trp-nav-link[^{]*\{[^}]*outline/.test(SRC));
}

console.log('\nTop nav — the colour of the line');
{
  check('deep green on paper, taken from the ink token',
    SRC_T.includes('--trp-nav-line:var(--trp-ink);'));
  check('and lime on the dark theme',
    SRC_T.includes(":root[data-theme='dark'].trp-nav-link{--trp-nav-line:rgb(var(--c-lime));}"));
  check('including for anyone on system dark',
    /@media \(prefers-color-scheme: dark\) \{[\s\S]*?:root\[data-theme='system'\] \.trp-nav-link \{ --trp-nav-line: rgb\(var\(--c-lime\)\); \}/.test(SRC));
  check('the ink token is #333A28 in light mode',
    /--c-deep: 51 58 40;/.test(SRC));
  check('and the lime token is #CCEEA0',
    /--c-lime: 204 238 160;/.test(SRC));
  // Nothing fancy: one flat colour per theme.
  const after = (SRC.match(/\.trp-nav-link::after \{[\s\S]*?\}/) || [''])[0];
  check('no gradient and no purple anywhere in the line',
    !/gradient/i.test(after) && !/#[0-9a-f]*(7c|8b|a0)[0-9a-f]*f0/i.test(after) && !/purple/i.test(after),
    after);
}

console.log('\nTop nav — less motion still gets the line');
{
  check('there is a reduced-motion rule for it',
    /@media \(prefers-reduced-motion: reduce\) \{\s*\.trp-nav-link::after \{ transition: none; \}/.test(SRC),
    (SRC.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]{0,120}/g) || []).slice(-1)[0]);
  check('it turns the transition off rather than hiding the line',
    SRC_T.includes('@media(prefers-reduced-motion:reduce){.trp-nav-link::after{transition:none;}}'));
}

console.log('\nTop nav — the build matches the source');
{
  check('the built stylesheet carries the ::after line',
    BUILT_T.includes('.trp-nav-link:after{'), BUILT.includes('trp-nav-link'));
  check('and the hover and focus rule',
    BUILT_T.includes('.trp-nav-link:focus-visible:after,.trp-nav-link:hover:after{transform:scaleX(1)}'));
  check('and the reduced-motion rule',
    BUILT_T.includes('@media(prefers-reduced-motion:reduce){.trp-nav-link:after{transition:none}}'));
  check('and the dark lime line',
    BUILT_T.includes(".trp-nav-link{--trp-nav-line:rgb(var(--c-lime))}"));
  check('the old filled pill is gone from the build',
    !/\.trp-nav-link\[aria-current=page\]\{[^}]*background/.test(BUILT),
    (BUILT.match(/\.trp-nav-link\[aria-current=page\]\{[^}]*\}/) || [])[0]);
}

console.log('\nTop nav — the mobile menu is not touched');
{
  for (const name of PAGES) {
    const d = doc(name);
    const menu = d.getElementById('mobile-menu');
    check(name + ': the slide-out menu uses none of the nav-link styling',
      menu !== null && menu.querySelectorAll('.trp-nav-link').length === 0,
      menu && menu.querySelectorAll('.trp-nav-link').length);
    check(name + ': and still marks its own current page its own way',
      menu.querySelectorAll('[aria-current="page"]').length === 1);
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
