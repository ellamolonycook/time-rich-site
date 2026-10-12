// The /os page's folded rows, run for real in jsdom: the page's own inline
// script wires them, so this drives the markup the way a reader would.
//
// The rule it exists to pin: every row keeps its anchor id, and the Stanley
// row is the one that is open when the page loads. Those two are what the
// Substack links and the nav depend on, and nothing else on the page would
// fail loudly if an edit broke them.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('../../os/index.html', import.meta.url), 'utf8');
const ROW_IDS = ['stanley', 'compass', 'skills', 'prompts', 'content-os', 'stack', 'live'];

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

/** A fresh page at the given URL, with its inline script run. */
function load(url = 'https://timerich.ai/os') {
  const dom = new JSDOM(HTML, { url, runScripts: 'dangerously', pretendToBeVisual: true });
  const { document } = dom.window;
  // jsdom has no layout, so scrollIntoView is missing on the elements the
  // page's anchor handler calls it on.
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  return { dom, document };
}

const isOpen = (document, id) => {
  const row = document.getElementById(id);
  return row.classList.contains('is-open') &&
    row.querySelector('.row-btn').getAttribute('aria-expanded') === 'true' &&
    row.querySelector('.row-panel').hidden === false;
};
const isFolded = (document, id) => {
  const row = document.getElementById(id);
  return !row.classList.contains('is-open') &&
    row.querySelector('.row-btn').getAttribute('aria-expanded') === 'false' &&
    row.querySelector('.row-panel').hidden === true;
};

console.log('\n/os — the rows');
{
  const { document } = load();

  check('every row id from the brief is on the page',
    ROW_IDS.every((id) => {
      const row = document.getElementById(id);
      return row && row.classList.contains('row');
    }),
    ROW_IDS.filter((id) => !document.getElementById(id)));

  check('the rows are in the brief\'s order, and there are no others',
    Array.from(document.querySelectorAll('#rowList > .row')).map((row) => row.id).join(',') === ROW_IDS.join(','),
    Array.from(document.querySelectorAll('#rowList > .row')).map((row) => row.id));

  check('the Stanley row is open on load', isOpen(document, 'stanley'));
  check('every other row starts folded',
    ROW_IDS.slice(1).every((id) => isFolded(document, id)),
    ROW_IDS.slice(1).filter((id) => !isFolded(document, id)));

  check('each row is opened by a button that names the panel it controls',
    ROW_IDS.every((id) => {
      const button = document.getElementById(id).querySelector('.row-btn');
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      return button.tagName === 'BUTTON' && panel && panel.classList.contains('row-panel');
    }));

  check('each panel points back at its button, for a screen reader',
    ROW_IDS.every((id) => {
      const row = document.getElementById(id);
      const button = row.querySelector('.row-btn');
      const panel = row.querySelector('.row-panel');
      return panel.getAttribute('aria-labelledby') === button.id;
    }));
}

console.log('\n/os — one row open at a time');
{
  const { document } = load();
  document.getElementById('compass').querySelector('.row-btn').click();
  check('opening another row opens it', isOpen(document, 'compass'));
  check('and closes Stanley', isFolded(document, 'stanley'));

  document.getElementById('compass').querySelector('.row-btn').click();
  check('clicking an open row folds it again', isFolded(document, 'compass'));
  check('and leaves every row folded', ROW_IDS.every((id) => isFolded(document, id)));
}

console.log('\n/os — the hash opens a row');
{
  const { document } = load('https://timerich.ai/os#compass');
  check('/os#compass opens the COMPASS row', isOpen(document, 'compass'));
  check('and Stanley is folded, not two rows open at once', isFolded(document, 'stanley'));
}
{
  const { document } = load('https://timerich.ai/os#nope');
  check('a hash that is not a row leaves Stanley open', isOpen(document, 'stanley'));
}

console.log('\n/os — the nav and the nested fold');
{
  const { document } = load();
  const nav = Array.from(document.querySelectorAll('#navlinks a')).map((a) => a.getAttribute('href'));
  check('every nav link points at a row on the page',
    nav.every((href) => href.startsWith('#') && document.getElementById(href.slice(1))?.classList.contains('row')),
    nav);

  document.querySelector('#navlinks a[href="#live"]').click();
  check('a nav link opens its row', isOpen(document, 'live'));

  document.querySelector('#navlinks a[href="#skills"]').click();
  const fold = document.getElementById('install');
  const foldButton = fold.querySelector('.fold-btn');
  const foldPanel = document.getElementById(foldButton.getAttribute('aria-controls'));
  check('"How to install a skill" starts folded',
    foldPanel.hidden === true && foldButton.getAttribute('aria-expanded') === 'false');
  foldButton.click();
  check('and opens on its own, without closing its row',
    foldPanel.hidden === false && foldButton.getAttribute('aria-expanded') === 'true' && isOpen(document, 'skills'));
}

console.log('\n/os — the copy buttons and the band');
{
  const { document } = load();
  const buttons = Array.from(document.querySelectorAll('[data-copy]'));
  check('three copy buttons, as the brief lists', buttons.length === 3, buttons.length);
  check('each one copies a block of text that is on the page',
    buttons.every((button) => {
      const source = document.getElementById(button.getAttribute('data-copy'));
      return source && source.textContent.trim().length > 100;
    }),
    buttons.map((b) => b.getAttribute('data-copy')));

  const band = document.getElementById('subscribe');
  check('the subscribe band is outside every row, so it is always visible',
    band && !band.closest('.row'));
}

console.log('\n/os — the mobile menu card');
{
  const { dom, document } = load();
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navlinks');
  const close = document.getElementById('navClose');
  const key = (name, shift) => document.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', { key: name, shiftKey: !!shift, bubbles: true, cancelable: true })
  );
  const behind = () => [
    document.querySelector('.skip'),
    document.querySelector('.wordmark'),
    document.querySelector('.nav .btn'),
    toggle,
    document.getElementById('main'),
    document.querySelector('footer'),
  ];

  check('the close button lives inside the card, not in the bar',
    close && close.closest('#navlinks') === links);

  toggle.click();
  check('the burger opens the card',
    links.classList.contains('open') && toggle.getAttribute('aria-expanded') === 'true');
  check('the burger keeps its icon rather than turning into a cross',
    toggle.textContent.trim() === '\u2630', toggle.textContent.trim());
  check('focus moves into the card, onto the close button',
    document.activeElement === close);
  // jsdom reflects `inert` as a plain property and does not act on it, so this
  // pins only that the page still marks the content behind. The behaviour it
  // buys is covered by the headless Chrome pass, not here.
  check('everything behind the scrim is marked inert',
    behind().every((node) => node.inert === true),
    behind().map((node) => node.tagName + ':' + node.inert));

  const stops = Array.from(links.querySelectorAll('button, a[href]'));
  check('the card holds the close button and the five links, in that order',
    stops.length === 6 && stops[0] === close, stops.length);

  stops[stops.length - 1].focus();
  key('Tab');
  check('Tab off the last link wraps to the close button', document.activeElement === close);
  close.focus();
  key('Tab', true);
  check('Shift+Tab off the close button wraps to the last link',
    document.activeElement === stops[stops.length - 1]);
  stops[1].focus();
  key('Tab');
  check('Tab in the middle of the card is left to the browser',
    document.activeElement === stops[1]);

  key('Escape');
  check('Escape closes the card', !links.classList.contains('open'));
  check('and hands focus back to the burger', document.activeElement === toggle);
  check('and lets the page behind go again',
    behind().every((node) => node.inert === false),
    behind().map((node) => node.tagName + ':' + node.inert));
}

{
  const { document } = load();
  const links = document.getElementById('navlinks');
  document.getElementById('navToggle').click();
  document.getElementById('navClose').click();
  check('the close button closes the card', !links.classList.contains('open'));

  document.getElementById('navToggle').click();
  document.querySelector('.nav').dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));
  check('a tap on the backdrop closes the card', !links.classList.contains('open'));

  document.getElementById('navToggle').click();
  links.querySelector('a[href="#live"]').click();
  check('picking a link closes the card and opens its row',
    !links.classList.contains('open') && document.getElementById('live').classList.contains('is-open'));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
